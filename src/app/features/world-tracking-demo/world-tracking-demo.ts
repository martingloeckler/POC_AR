import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CameraService } from '../../shared/services/camera.service';

@Component({
  selector: 'app-world-tracking-demo',
  standalone: true,
  templateUrl: './world-tracking-demo.html',
  styleUrl: './world-tracking-demo.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorldTrackingDemoComponent implements AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly cameraService = inject(CameraService);
  private readonly runtimeResetStorageKey = 'x8-runtime-reset-once';
  private teardownFns: Array<() => void> = [];
  private originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia | null = null;
  private directCameraStream: MediaStream | null = null;
  private cameraDirectionFallbackUsed = false;
  private xrCameraFeedObserved = false;
  private cameraFeedMonitorRegistered = false;
  private readonly cameraFeedMonitorModuleName = 'poc-ar-camera-feed-monitor-wt';
  private xrLastCameraStatus: string | null = null;
  private xrLastTextureSource: string | null = null;
  private xrCanvasVisibleObserved = false;
  private xrRunObserved = false;
  private xrRunInstrumented = false;
  private xrDiagnosticsLogged = new Set<string>();

  // Model + animation state
  private modelLoaded = false;
  private animationHost: any = null;
  private animations: any[] = [];
  private animationMixer: any = null;
  private animationRunning = false;

  // World-tracking flow: locked after first image target detection
  private targetLocked = false;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly showBrowserWarning = signal(false);
  protected readonly runtimeReady = signal(false);
  protected readonly sceneMounted = signal(false);
  protected readonly worldTrackingActive = signal(false);
  protected readonly modelVisible = signal(false);
  protected readonly animating = signal(false);
  protected readonly xrwebConfig = signal('disableWorldTracking: false');
  protected readonly xrconfigValue = signal('allowedDevices: any; cameraDirection: back');
  protected readonly directCameraFallbackActive = signal(false);
  protected readonly directCameraFallbackReason = signal<string | null>(null);
  // Null until target is found – prevents the GLB from loading during image-target search.
  protected readonly rehModelSrc = signal<string | null>(null);

  private readonly rehModelUrl = this.resolveAssetUrl('models/Reh.glb');

  constructor() {
    if (this.cameraService.isSamsungInternetBrowser()) {
      this.showBrowserWarning.set(true);
    }
  }

  async ngAfterViewInit(): Promise<void> {
    await this.startRuntime();
  }

  ngOnDestroy(): void {
    this.stopRuntime();
  }

  protected async retry(): Promise<void> {
    await this.startRuntime();
  }

  // ---------------------------------------------------------------------------
  // Runtime lifecycle
  // ---------------------------------------------------------------------------

  private async startRuntime(): Promise<void> {
    if (this.shouldForceCleanReload()) {
      this.forceCleanReload();
      return;
    }

    this.stopRuntime();
    this.loading.set(true);
    this.error.set(null);
    this.runtimeReady.set(false);
    this.sceneMounted.set(false);
    this.worldTrackingActive.set(false);
    this.modelVisible.set(false);
    this.animating.set(false);
    this.rehModelSrc.set(null);
    this.targetLocked = false;
    this.modelLoaded = false;
    this.animationRunning = false;
    this.directCameraFallbackReason.set(null);
    this.xrwebConfig.set('disableWorldTracking: false');
    this.xrconfigValue.set(this.buildXrconfig(this.getPreferredCameraDirection()));
    this.resetXrDiagnostics();

    try {
      await this.ensureCameraPermission();
      await this.patchBestRearCameraIfAvailable();

      await this.loadScriptOnce(this.resolveAssetUrl('8thwall/xr.js'));
      await this.waitForXrLoaded();
      this.bridgeLegacyXrAliasToXr8();

      for (const scriptPath of this.getRuntimeScriptsAfterXr()) {
        await this.loadScriptOnce(this.resolveAssetUrl(scriptPath));
      }

      const xr8 = this.getXrRuntime();
      if (!xr8) {
        throw new Error('XR runtime (XR8/XR) not found after xrloaded event.');
      }

      this.instrumentXrRun(xr8);
      this.ensureAFrameXrComponentsRegistered(xr8);
      this.registerCameraFeedMonitor(xr8);
      await this.ensureSlamControllerReady(xr8);
      const xrController = this.getXrController(xr8);

      // Configure wichtel image target as trigger
      const wichtelTargetData = await this.loadImageTargetData('imagetargets/wichtel.json');
      if (wichtelTargetData) {
        if (!xrController || typeof xrController.configure !== 'function') {
          throw new Error('XR8 XrController is unavailable after xrloaded event.');
        }
        xrController.configure({ imageTargetData: [wichtelTargetData] });
      }

      this.sceneMounted.set(true);
      await this.waitForSceneElement();
      await this.waitForSceneReady();
      this.bindTargetEvents();
      this.bindModelEvents();
      this.runtimeReady.set(true);

      const cameraFeedVisible = await this.waitForCameraFeed(4500);
      if (!cameraFeedVisible && this.canUseDirectionFallback()) {
        this.cameraDirectionFallbackUsed = true;
        this.xrconfigValue.set(this.buildXrconfig('front'));
        this.logXrDiagnostic('retry-front', 'Camera feed stayed black. Retrying once with front camera direction.');
        await this.startRuntime();
        return;
      }

      if (!cameraFeedVisible) {
        this.logXrDiagnostic('fallback', this.buildCameraFallbackDiagnostic());
        await this.enableDirectCameraFallback();
      }

      this.clearCleanReloadMarker();
    } catch (err) {
      console.error('[world-tracking] Runtime init failed:', err);
      this.clearCleanReloadMarker();
      this.error.set(
        '8th-Wall konnte nicht gestartet werden. Pruefe public/8thwall/xr.js (gueltiges JS, kein HTML) sowie 8frame.min.js und xrextras.js.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private stopRuntime(): void {
    this.teardownFns.forEach((fn) => fn());
    this.teardownFns = [];

    this.stopAnimationTicker();

    const xr8 = (window as unknown as { XR8?: { stop?: () => void } }).XR8;
    if (
      this.cameraFeedMonitorRegistered &&
      xr8 &&
      typeof (xr8 as { removeCameraPipelineModule?: (name: string) => void }).removeCameraPipelineModule ===
        'function'
    ) {
      (xr8 as { removeCameraPipelineModule: (name: string) => void }).removeCameraPipelineModule(
        this.cameraFeedMonitorModuleName,
      );
      this.cameraFeedMonitorRegistered = false;
    }

    if (xr8?.stop) {
      xr8.stop();
    }

    this.xrCameraFeedObserved = false;
    this.xrCanvasVisibleObserved = false;
    this.disableDirectCameraFallback();
    this.restoreGetUserMedia();
  }

  // ---------------------------------------------------------------------------
  // Image target → world placement
  // ---------------------------------------------------------------------------

  private bindTargetEvents(): void {
    const target = this.document.getElementById('wichtel-trigger');
    const scene = this.document.getElementById('x8-scene');
    if (!target || !scene) {
      this.error.set('8th-Wall-Szene wurde geladen, aber das Target-Element fehlt.');
      return;
    }

    const onFound = (event: Event) => {
      if (this.targetLocked) return;
      this.targetLocked = true;
      console.info('[world-tracking] Wichtel target found – switching to world tracking mode.');
      this.worldTrackingActive.set(true);

      const detail = (event as CustomEvent).detail as
        | { position?: { x: number; y: number; z: number }; rotation?: unknown }
        | undefined;
      this.placeModelAtTarget(detail?.position);

      // Disable image tracking so SLAM runs alone – more stable world tracking.
      this.disableImageTracking();
    };

    const foundEvents = ['xrextrasnamedimagefound', 'xrimagefound', 'targetFound', 'markerFound'];

    const addListeners = (el: Element) =>
      foundEvents.forEach((name) => el.addEventListener(name, onFound as EventListener));
    const removeListeners = (el: Element) =>
      foundEvents.forEach((name) => el.removeEventListener(name, onFound as EventListener));

    addListeners(target);
    addListeners(scene);

    const stopVisibilityMonitor = this.startTargetVisibilityMonitor(target as HTMLElement, onFound);

    this.teardownFns.push(() => {
      removeListeners(target);
      removeListeners(scene);
      stopVisibilityMonitor();
    });
  }

  /**
   * After the first image target detection, reconfigure XrController with an
   * empty imageTargetData array. This stops the image-tracking pipeline so XR8
   * can dedicate all resources to SLAM/world-tracking, which makes the placed
   * object considerably more stable.
   */
  private disableImageTracking(): void {
    const xr8 = this.getXrRuntime();
    const xrController = this.getXrController(xr8);
    if (!xrController || typeof xrController.configure !== 'function') {
      console.warn('[world-tracking] Cannot disable image tracking – XrController not available.');
      return;
    }
    try {
      xrController.configure({ imageTargetData: [] });
      this.logXrDiagnostic('image-tracking-disabled', 'Image tracking disabled after first target lock.');
    } catch (err) {
      console.warn('[world-tracking] Failed to disable image tracking:', err);
    }
  }

  /**
  * Positions the reh model 1.5 m in front of the user, starting from the
   * detected image target position (which is assumed to lie flat on the ground).
   * The camera's forward vector is projected onto the XZ ground plane and
   * normalised so the offset is always horizontal regardless of camera tilt.
   */
  private placeModelAtTarget(position: { x: number; y: number; z: number } | undefined): void {
    const anchor = this.document.getElementById('reh-anchor') as
      | (HTMLElement & { setAttribute: (n: string, v: unknown) => void })
      | null;
    if (!anchor) return;

    const px = position?.x ?? 0;
    const py = position?.y ?? 0;   // target is on the ground → use its Y as floor level
    const pz = position?.z ?? 0;

    const DISTANCE_M = 6.5;

    // Compute the camera's world-space forward direction via THREE.js,
    // flattened onto the ground plane so camera tilt doesn't affect placement.
    const THREE = (window as unknown as { THREE?: any }).THREE;
    let offsetX = 0;
    let offsetZ = -DISTANCE_M; // fallback: straight ahead in world Z

    const cameraEl = this.document.querySelector('[camera]') as
      | (HTMLElement & { object3D?: any })
      | null;

    if (THREE && cameraEl?.object3D) {
      try {
        const worldQuat = new THREE.Quaternion();
        cameraEl.object3D.getWorldQuaternion(worldQuat);
        // Forward vector in Three.js camera space is (0, 0, -1)
        const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat);
        // Flatten onto XZ plane and re-normalise so tilt doesn't shrink the offset
        forwardVec.y = 0;
        const len = forwardVec.length();
        if (len > 0.001) {
          forwardVec.divideScalar(len);
        }
        offsetX = forwardVec.x * DISTANCE_M;
        offsetZ = forwardVec.z * DISTANCE_M;
      } catch {
        // Fall back to static Z offset
      }
    }

    anchor.setAttribute('position', `${px + offsetX} ${py} ${pz + offsetZ}`);
    anchor.setAttribute('visible', 'true');
    // Trigger GLB fetch + GPU upload only now, after image tracking is no longer running.
    this.rehModelSrc.set(this.rehModelUrl);
    this.modelVisible.set(true);
  }

  // ---------------------------------------------------------------------------
  // Model loading & click-to-animate
  // ---------------------------------------------------------------------------

  private bindModelEvents(): void {
    const modelEl = this.document.getElementById('reh-model') as
      | (HTMLElement & { getObject3D?: (n: string) => any })
      | null;
    if (!modelEl) return;

    const onModelLoaded = (event: Event) => {
      const e = event as CustomEvent<{ model?: { animations?: any[] } }>;
      this.modelLoaded = true;
      this.animationHost = e.detail?.model ?? modelEl.getObject3D?.('mesh') ?? null;
      this.animations = this.animationHost?.animations ?? [];
      console.info(`[world-tracking] Reh model loaded. Animations: ${this.animations.length}`);
    };

    const onModelClick = () => {
      this.toggleAnimation();
      this.showRehInfo.set(true);
    };

    modelEl.addEventListener('model-loaded', onModelLoaded as EventListener);
    modelEl.addEventListener('click', onModelClick as EventListener);

    this.teardownFns.push(() => {
      modelEl.removeEventListener('model-loaded', onModelLoaded as EventListener);
      modelEl.removeEventListener('click', onModelClick as EventListener);
    });
  }

  hideRehInfo() {
    this.showRehInfo.set(false);
  }

  protected toggleAnimation(): void {
    if (!this.modelLoaded) return;
    if (this.animationRunning) {
      this.stopAnimationTicker();
      this.animationRunning = false;
      this.animating.set(false);
    } else {
      this.playAnimation();
    }
  }

  private playAnimation(): void {
    const THREE = (window as unknown as { THREE?: any }).THREE;
    if (!THREE || !this.animationHost || this.animations.length === 0) {
      console.warn('[world-tracking] Cannot play animation – model or THREE.js not ready.');
      return;
    }

    this.stopAnimationTicker();
    this.animationMixer = new THREE.AnimationMixer(this.animationHost);
    this.animations.forEach((clip: any) => {
      this.animationMixer.clipAction(clip).reset().play();
    });

    this.animationRunning = true;
    this.animating.set(true);
    // Mixer is ticked by the A-Frame 'reh-animator' component (tick hook),
    // which runs inside XR8's existing render loop – no competing rAF needed.
  }

  private stopAnimationTicker(): void {
    if (this.animationMixer) {
      this.animationMixer.stopAllAction();
      this.animationMixer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Target visibility polling (fallback for browsers that miss DOM events)
  // ---------------------------------------------------------------------------

  private startTargetVisibilityMonitor(
    target: HTMLElement,
    onFound: (event: Event) => void,
  ): () => void {
    if (this.targetLocked) return () => {};

    let wasVisible = this.isTargetCurrentlyVisible(target);

    const intervalId = this.document.defaultView?.setInterval(() => {
      if (this.targetLocked) return;
      const isVisible = this.isTargetCurrentlyVisible(target);
      if (isVisible !== wasVisible && isVisible) {
        wasVisible = isVisible;
        onFound(new CustomEvent('targetVisibleStateFound'));
      } else {
        wasVisible = isVisible;
      }
    }, 120);

    return () => {
      if (typeof intervalId === 'number') {
        this.document.defaultView?.clearInterval(intervalId);
      }
    };
  }

  private isTargetCurrentlyVisible(target: HTMLElement): boolean {
    const targetEntity = target as HTMLElement & {
      object3D?: { visible?: boolean };
      getAttribute: (name: string) => unknown;
    };
    const object3DVisible = targetEntity.object3D?.visible;
    if (typeof object3DVisible === 'boolean') return object3DVisible;
    return targetEntity.getAttribute('visible') !== 'false';
  }

  // ---------------------------------------------------------------------------
  // Shared 8th Wall infrastructure (copied from EighthWallDemoComponent)
  // ---------------------------------------------------------------------------

  private getRuntimeScriptsAfterXr(): string[] {
    return ['8thwall/8frame.min.js', '8thwall/xrextras.js'];
  }

  private bridgeLegacyXrAliasToXr8(): void {
    const globalWindow = window as unknown as { XR8?: unknown; XR?: unknown };
    if (!globalWindow.XR8) return;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(globalWindow, 'XR');
      if (descriptor && descriptor.configurable === false && !descriptor.set) return;
      Object.defineProperty(globalWindow, 'XR', { configurable: true, writable: true, value: globalWindow.XR8 });
    } catch (err) {
      console.warn('[world-tracking] Failed to bridge XR alias to XR8:', err);
    }
  }

  private shouldForceCleanReload(): boolean {
    const globalWindow = window as unknown as { AFRAME?: unknown };
    const hasAFrame = Boolean(globalWindow.AFRAME);
    const alreadyReset = this.document.defaultView?.sessionStorage.getItem(this.runtimeResetStorageKey);
    return hasAFrame && alreadyReset !== '1';
  }

  private forceCleanReload(): void {
    this.document.defaultView?.sessionStorage.setItem(this.runtimeResetStorageKey, '1');
    this.document.defaultView?.location.reload();
  }

  private clearCleanReloadMarker(): void {
    this.document.defaultView?.sessionStorage.removeItem(this.runtimeResetStorageKey);
  }

  private instrumentXrRun(xr8: any): void {
    if (this.xrRunInstrumented || typeof xr8?.run !== 'function') return;
    const originalRun = xr8.run.bind(xr8);
    xr8.run = (runConfig: Record<string, unknown>) => {
      this.xrRunObserved = true;
      this.logXrDiagnostic('xr-run', `XR8.run invoked. keys=${Object.keys(runConfig ?? {}).join(',') || 'none'}`);
      return originalRun(runConfig);
    };
    this.xrRunInstrumented = true;
  }

  private ensureAFrameXrComponentsRegistered(xr8: any): void {
    const globalWindow = window as unknown as {
      AFRAME?: {
        components?: Record<string, unknown>;
        registerComponent?: (name: string, definition: unknown) => void;
      };
      XRExtras?: { AFrame?: { registerXrExtrasComponents?: () => void } };
    };
    const aframe = globalWindow.AFRAME;
    if (!aframe?.registerComponent || !xr8?.AFrame) {
      this.logXrDiagnostic('aframe-missing', 'AFRAME or XR8.AFrame was not available for explicit component registration.');
      return;
    }
    const ensureComponent = (name: string, factory: (() => unknown) | undefined) => {
      if (!factory || aframe.components?.[name]) return;
      aframe.registerComponent?.(name, factory());
      this.logXrDiagnostic('component-' + name, `Registered A-Frame component: ${name}`);
    };
    ensureComponent('xrconfig', xr8.AFrame.xrconfigComponent);
    ensureComponent('xrweb', xr8.AFrame.xrwebComponent);
    ensureComponent('xrface', xr8.AFrame.xrfaceComponent);
    ensureComponent('xrlayers', xr8.AFrame.xrlayersComponent);
    ensureComponent('xrlayerscene', xr8.AFrame.xrlayersceneComponent);
    globalWindow.XRExtras?.AFrame?.registerXrExtrasComponents?.();
    this.logXrDiagnostic('xrextras-components', 'XR Extras A-Frame components ensured.');
    this.registerRehAnimatorComponent();
  }

  /**
   * Registers a lightweight A-Frame component that ticks the AnimationMixer
   * inside A-Frame's own render loop. This eliminates a competing rAF loop
   * and is the primary fix for animation-induced stutter.
   */
  private registerRehAnimatorComponent(): void {
    const AFRAME = (window as unknown as { AFRAME?: any }).AFRAME;
    if (!AFRAME?.registerComponent || AFRAME.components?.['reh-animator']) return;

    // Capture a stable reference to this component instance for the closure.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    AFRAME.registerComponent('reh-animator', {
      tick(_time: number, delta: number) {
        if (self.animationMixer) {
          self.animationMixer.update(delta / 1000);
        }
      },
    });
    this.logXrDiagnostic('reh-animator-registered', 'A-Frame reh-animator tick component registered.');
  }

  private registerCameraFeedMonitor(xr8: any): void {
    this.xrCameraFeedObserved = false;
    this.xrCanvasVisibleObserved = false;
    if (typeof xr8?.addCameraPipelineModule !== 'function') return;
    xr8.addCameraPipelineModule({
      name: this.cameraFeedMonitorModuleName,
      onCameraStatusChange: ({ status }: { status?: string }) => {
        this.xrLastCameraStatus = status ?? null;
        this.logXrDiagnostic('camera-status-' + (status ?? 'unknown'), `XR camera status: ${status ?? 'unknown'}`);
        if (status === 'hasVideo') this.xrCameraFeedObserved = true;
      },
      onUpdate: ({ processCpuResult }: { processCpuResult?: Record<string, any> }) => {
        const realityTexture = processCpuResult?.['reality']?.realityTexture;
        const faceTexture = processCpuResult?.['facecontroller']?.cameraFeedTexture;
        const handTexture = processCpuResult?.['handcontroller']?.cameraFeedTexture;
        const layerTexture = processCpuResult?.['layerscontroller']?.cameraFeedTexture;
        const activeTextureSource = realityTexture
          ? 'realityTexture'
          : faceTexture
            ? 'facecontroller.cameraFeedTexture'
            : handTexture
              ? 'handcontroller.cameraFeedTexture'
              : layerTexture
                ? 'layerscontroller.cameraFeedTexture'
                : null;
        if (activeTextureSource) {
          this.xrLastTextureSource = activeTextureSource;
          this.logXrDiagnostic('texture-source-' + activeTextureSource, `XR pipeline produced ${activeTextureSource}.`);
        }
        if (realityTexture || faceTexture || handTexture || layerTexture) this.xrCameraFeedObserved = true;
      },
    });
    this.cameraFeedMonitorRegistered = true;
  }

  private async ensureSlamControllerReady(xr8: any): Promise<void> {
    if (this.getXrController(xr8)?.configure) return;
    if (typeof xr8?.loadChunk === 'function') {
      try {
        await xr8.loadChunk('slam');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes('Cannot redefine property: xrController')) {
          console.warn('[world-tracking] XR8.loadChunk("slam") failed:', err);
        }
      }
    }
    for (let i = 0; i < 12; i++) {
      if (this.getXrController(xr8)?.configure) return;
      await this.sleep(100);
    }
    throw new Error('XR8 XrController is unavailable after xrloaded + slam preload.');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => this.document.defaultView?.setTimeout(resolve, ms));
  }

  private getPreferredCameraDirection(): 'back' | 'front' {
    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    return isMobile ? 'back' : 'front';
  }

  private buildXrconfig(direction: 'back' | 'front'): string {
    return `allowedDevices: any; cameraDirection: ${direction}`;
  }

  private canUseDirectionFallback(): boolean {
    if (this.cameraDirectionFallbackUsed) return false;
    return this.getPreferredCameraDirection() === 'back';
  }

  private async waitForCameraFeed(timeoutMs: number): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const scene = this.document.getElementById('x8-scene');
      if (this.xrCameraFeedObserved || this.xrCanvasVisibleObserved) {
        this.xrCanvasVisibleObserved = true;
        return true;
      }
      const video = scene?.querySelector('video') as HTMLVideoElement | null;
      if (video && video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        this.logXrDiagnostic('video-visible', 'Scene video element contains camera frames.');
        return true;
      }
      await this.sleep(120);
    }
    return false;
  }

  private async ensureCameraPermission(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia wird von diesem Browser nicht unterstuetzt.');
    }
    const permissionState = await this.getCameraPermissionState();
    if (permissionState === 'denied') {
      throw new Error(
        'Kamerazugriff ist im Browser blockiert. Bitte in den Website-Berechtigungen Kamera auf Zulassen setzen und Seite neu laden.',
      );
    }
    const facingMode = this.getPreferredCameraDirection() === 'back' ? 'environment' : 'user';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((track) => track.stop());
    }
  }

  private resetXrDiagnostics(): void {
    this.xrLastCameraStatus = null;
    this.xrLastTextureSource = null;
    this.xrCanvasVisibleObserved = false;
    this.xrRunObserved = false;
    this.xrDiagnosticsLogged.clear();
  }

  private buildCameraFallbackDiagnostic(): string {
    return [
      'Falling back to direct camera mode.',
      `xrRunObserved=${this.xrRunObserved ? 'yes' : 'no'}`,
      `lastCameraStatus=${this.xrLastCameraStatus ?? 'none'}`,
      `textureSource=${this.xrLastTextureSource ?? 'none'}`,
      `canvasVisible=${this.xrCanvasVisibleObserved ? 'yes' : 'no'}`,
      `preferredDirection=${this.cameraDirectionFallbackUsed ? 'front' : this.getPreferredCameraDirection()}`,
    ].join(' ');
  }

  private logXrDiagnostic(key: string, message: string): void {
    if (this.xrDiagnosticsLogged.has(key)) return;
    this.xrDiagnosticsLogged.add(key);
    console.info('[world-tracking][diag]', message);
  }

  private async enableDirectCameraFallback(): Promise<void> {
    this.directCameraFallbackReason.set('XR-Kamerabild blieb schwarz. Direkter Webcam-Notfallmodus ist aktiv.');
    if (this.directCameraStream) {
      this.directCameraFallbackActive.set(true);
      return;
    }
    this.directCameraStream = await this.acquireWorkingCameraStream();
    this.directCameraFallbackActive.set(true);
    const video = await this.waitForElementById<HTMLVideoElement>('direct-camera-video', 1500);
    if (!video) return;
    video.srcObject = this.directCameraStream;
    await video.play().catch((err) => console.warn('[world-tracking] Direct camera fallback video play failed:', err));
  }

  private async acquireWorkingCameraStream(): Promise<MediaStream> {
    const attempts = await this.buildDirectCameraAttempts();
    let firstStream: MediaStream | null = null;
    for (const videoConstraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
        if (!firstStream) firstStream = stream;
        const hasVisibleFrames = await this.streamHasVisibleFrames(stream, 2000);
        if (hasVisibleFrames) {
          if (firstStream && firstStream !== stream) firstStream.getTracks().forEach((t) => t.stop());
          return stream;
        }
        if (stream !== firstStream) stream.getTracks().forEach((t) => t.stop());
      } catch {
        // Try next profile.
      }
    }
    if (!firstStream) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        firstStream = stream;
        if (await this.streamHasVisibleFrames(stream, 2000)) return stream;
      } catch {
        // Ignore.
      }
    }
    if (firstStream) {
      this.directCameraFallbackReason.set(
        'Direkter Webcam-Modus aktiv, aber Kamerastream wirkt schwarz. Bitte andere Kamera im Browser waehlen.',
      );
      return firstStream;
    }
    throw new Error('Kein verwendbarer Kamerastream fuer den Notfallmodus gefunden.');
  }

  private async buildDirectCameraAttempts(): Promise<MediaTrackConstraints[]> {
    const preferred: 'environment' | 'user' = this.cameraDirectionFallbackUsed ? 'user' : 'environment';
    const opposite: 'environment' | 'user' = preferred === 'environment' ? 'user' : 'environment';
    const attempts: MediaTrackConstraints[] = [
      { facingMode: { ideal: preferred } },
      { facingMode: { ideal: opposite } },
    ];
    const devices = await navigator.mediaDevices.enumerateDevices();
    devices.filter((d) => d.kind === 'videoinput').forEach((d) => attempts.push({ deviceId: { exact: d.deviceId } }));
    return attempts;
  }

  private async streamHasVisibleFrames(stream: MediaStream, timeoutMs: number): Promise<boolean> {
    const video = this.document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = stream;
    const loaded = await new Promise<boolean>((resolve) => {
      const onLoadedData = () => { cleanup(); resolve(true); };
      const cleanup = () => {
        video.removeEventListener('loadeddata', onLoadedData);
        this.document.defaultView?.clearTimeout(timer);
      };
      const timer = this.document.defaultView?.setTimeout(() => { cleanup(); resolve(false); }, Math.min(timeoutMs, 1200));
      video.addEventListener('loadeddata', onLoadedData, { once: true });
      void video.play().catch(() => {});
    });
    if (!loaded) { video.srcObject = null; return false; }
    const startedAt = Date.now();
    let lastTime = video.currentTime;
    while (Date.now() - startedAt < timeoutMs) {
      if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        if (video.currentTime > lastTime || !video.paused) { video.srcObject = null; return true; }
        lastTime = video.currentTime;
      }
      await this.sleep(100);
    }
    video.srcObject = null;
    return false;
  }

  private disableDirectCameraFallback(): void {
    const video = this.document.getElementById('direct-camera-video') as HTMLVideoElement | null;
    if (video) video.srcObject = null;
    this.directCameraStream?.getTracks().forEach((t) => t.stop());
    this.directCameraStream = null;
    this.directCameraFallbackActive.set(false);
    this.directCameraFallbackReason.set(null);
  }

  private async waitForElementById<T extends HTMLElement>(id: string, timeoutMs: number): Promise<T | null> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const element = this.document.getElementById(id) as T | null;
      if (element) return element;
      await this.sleep(50);
    }
    return null;
  }

  private async patchBestRearCameraIfAvailable(): Promise<void> {
    if (!this.cameraService.isSamsungInternetBrowser() || this.originalGetUserMedia) return;
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices?.getUserMedia) return;
    const preferredDeviceId = await this.cameraService.getBestRearCameraId();
    if (!preferredDeviceId) return;
    this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const original = this.originalGetUserMedia;
    navigator.mediaDevices.getUserMedia = (constraints?: MediaStreamConstraints) => {
      const requestedVideo = constraints?.video;
      if (!requestedVideo) return original(constraints);
      const patchedVideo: MediaTrackConstraints =
        typeof requestedVideo === 'boolean'
          ? { deviceId: { exact: preferredDeviceId }, facingMode: { ideal: 'environment' } }
          : { ...requestedVideo, deviceId: { exact: preferredDeviceId }, facingMode: { ideal: 'environment' } };
      return original({ ...constraints, video: patchedVideo });
    };
  }

  private restoreGetUserMedia(): void {
    if (!this.originalGetUserMedia || !navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia = this.originalGetUserMedia;
    this.originalGetUserMedia = null;
  }

  private loadScriptOnce(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = this.document.querySelector(`script[data-runtime-src="${src}"]`);
      if (existing) { resolve(); return; }
      const script = this.document.createElement('script');
      script.src = src;
      script.async = true;
      if (src.includes('/8thwall/xr.js')) script.setAttribute('data-preload-chunks', 'slam');
      script.dataset['runtimeSrc'] = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Script load failed: ${src}`));
      this.document.head.appendChild(script);
    });
  }

  private waitForXrLoaded(): Promise<void> {
    return new Promise((resolve) => {
      const runtime = this.getXrRuntime();
      if (runtime) { resolve(); return; }
      const onLoaded = () => {
        this.document.defaultView?.removeEventListener('xrloaded', onLoaded as EventListener);
        resolve();
      };
      this.document.defaultView?.addEventListener('xrloaded', onLoaded as EventListener, { once: true });
    });
  }

  private getXrRuntime(): any {
    return (window as unknown as { XR8?: any }).XR8 ?? null;
  }

  private getXrController(xr8: any): any {
    return xr8?.XrController ?? xr8?.xrController ?? null;
  }

  private waitForSceneReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const scene = this.document.getElementById('x8-scene') as (HTMLElement & { hasLoaded?: boolean }) | null;
      if (!scene) { reject(new Error('8th-Wall scene element not found.')); return; }
      if (scene.hasLoaded) { resolve(); return; }
      const onLoaded = () => { scene.removeEventListener('loaded', onLoaded as EventListener); resolve(); };
      scene.addEventListener('loaded', onLoaded as EventListener, { once: true });
    });
  }

  private waitForSceneElement(): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = this.document.getElementById('x8-scene');
      if (existing) { resolve(); return; }
      const observer = new MutationObserver(() => {
        const scene = this.document.getElementById('x8-scene');
        if (scene) { observer.disconnect(); resolve(); }
      });
      observer.observe(this.document.body, { childList: true, subtree: true });
      this.document.defaultView?.setTimeout(() => {
        observer.disconnect();
        reject(new Error('8th-Wall scene element was not rendered.'));
      }, 5000);
    });
  }

  private async getCameraPermissionState(): Promise<'granted' | 'prompt' | 'denied' | 'unknown'> {
    const permissionApi = (navigator as Navigator & {
      permissions?: { query: (descriptor: { name: string }) => Promise<{ state: string }> };
    }).permissions;
    if (!permissionApi?.query) return 'unknown';
    try {
      const result = await permissionApi.query({ name: 'camera' });
      if (result.state === 'granted' || result.state === 'prompt' || result.state === 'denied') return result.state;
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async loadImageTargetData(path: string): Promise<Record<string, unknown> | null> {
    try {
      const assetUrl = this.resolveAssetUrl(path);
      const response = await fetch(assetUrl);
      if (!response.ok) throw new Error(`Failed to fetch: ${assetUrl}`);
      return await response.json();
    } catch (err) {
      console.warn('[world-tracking] Failed to load image target data:', err);
      return null;
    }
  }

  private resolveAssetUrl(path: string): string {
    const normalizedPath = path.replace(/^\/+/, '');
    return new URL(normalizedPath, this.document.baseURI).toString();
  }

  protected readonly showRehInfo = signal(false);
}

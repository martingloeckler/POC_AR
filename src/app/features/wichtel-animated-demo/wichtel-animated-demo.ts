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
  selector: 'app-wichtel-animated-demo',
  standalone: true,
  templateUrl: './wichtel-animated-demo.html',
  styleUrl: './wichtel-animated-demo.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WichtelAnimatedDemoComponent implements AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly cameraService = inject(CameraService);
  private readonly runtimeResetStorageKey = 'x8-runtime-reset-once';
  private teardownFns: Array<() => void> = [];
  private originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia | null = null;
  private directCameraStream: MediaStream | null = null;
  private cameraDirectionFallbackUsed = false;
  private xrCameraFeedObserved = false;
  private cameraFeedMonitorRegistered = false;
  private readonly cameraFeedMonitorModuleName = 'poc-ar-camera-feed-monitor';
  private xrLastCameraStatus: string | null = null;
  private xrLastTextureSource: string | null = null;
  private xrCanvasVisibleObserved = false;
  private xrRunObserved = false;
  private xrRunInstrumented = false;
  private xrDiagnosticsLogged = new Set<string>();
  private audioPrimed = false;
  private celebrationRunning = false;
  private celebrationPendingStart = false;
  private celebrationModelLoaded = false;
  private celebrationAnimationHost: any = null;
  private celebrationAnimations: any[] = [];
  private celebrationMixer: any = null;
  private celebrationLastTickMs: number | null = null;
  private celebrationTickId: number | null = null;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly showBrowserWarning = signal(false);
  protected readonly targetDetected = signal(false);
  protected readonly celebrationVisible = signal(false);
  protected readonly celebrationBusy = signal(false);
  protected readonly runtimeReady = signal(false);
  protected readonly sceneMounted = signal(false);
  protected readonly xrwebConfig = signal('disableWorldTracking: true');
  protected readonly xrconfigValue = signal('allowedDevices: any; cameraDirection: back');
  protected readonly directCameraFallbackActive = signal(false);
  protected readonly directCameraFallbackReason = signal<string | null>(null);

  protected readonly wichtelModelUrl = this.resolveAssetUrl('models/MushroomJubel.glb');
  protected readonly wichtelAudioUrl = this.resolveAssetUrl('sounds/WichtelTest.mp3');

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

  protected async unlockAudio(): Promise<void> {
    if (this.audioPrimed) {
      return;
    }

    const audio = this.document.getElementById('wichtel-audio') as HTMLAudioElement | null;
    if (!audio) return;

    try {
      audio.muted = false;
      audio.volume = 1;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      this.audioPrimed = true;
      this.logXrDiagnostic('audio-unlocked', 'Audio unlocked via user gesture.');
    } catch (err) {
      console.warn('[8th-wall] Audio unlock failed:', err);
    }
  }

  private async startRuntime(): Promise<void> {
    if (this.shouldForceCleanReload()) {
      this.forceCleanReload();
      return;
    }

    this.stopRuntime();
    this.loading.set(true);
    this.error.set(null);
    this.targetDetected.set(false);
    this.celebrationVisible.set(false);
    this.celebrationBusy.set(false);
    this.celebrationRunning = false;
    this.celebrationPendingStart = false;
    this.runtimeReady.set(false);
    this.sceneMounted.set(false);
    this.directCameraFallbackReason.set(null);
    this.xrwebConfig.set(this.buildXrwebConfig());
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

      // Configure wichtel image target
      const wichtelTargetData = await this.loadImageTargetData('imagetargets/wichtel.json');
      if (wichtelTargetData) {
        if (!xrController || typeof xrController.configure !== 'function') {
          throw new Error('XR8 XrController is unavailable after xrloaded event.');
        }

        xrController.configure({
          imageTargetData: [wichtelTargetData],
        });
      }

      this.sceneMounted.set(true);
      await this.waitForSceneElement();
      await this.waitForSceneReady();
      this.registerAudioUnlockHooks();
      this.bindTargetEvents();
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
      console.error('[8th-wall] Runtime init failed:', err);
      this.clearCleanReloadMarker();
      this.error.set(
        '8th-Wall konnte nicht gestartet werden. Pruefe public/8thwall/xr.js (gueltiges JS, kein HTML) sowie 8frame.min.js und xrextras.js.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private getRuntimeScriptsAfterXr(): string[] {
    return ['8thwall/8frame.min.js', '8thwall/xrextras.js'];
  }

  private bridgeLegacyXrAliasToXr8(): void {
    const globalWindow = window as unknown as {
      XR8?: unknown;
      XR?: unknown;
    };

    if (!globalWindow.XR8) {
      return;
    }

    try {
      const descriptor = Object.getOwnPropertyDescriptor(globalWindow, 'XR');
      if (descriptor && descriptor.configurable === false && !descriptor.set) {
        return;
      }

      Object.defineProperty(globalWindow, 'XR', {
        configurable: true,
        writable: true,
        value: globalWindow.XR8,
      });
    } catch (err) {
      console.warn('[8th-wall] Failed to bridge XR alias to XR8:', err);
    }
  }

  private shouldForceCleanReload(): boolean {
    const globalWindow = window as unknown as { AFRAME?: unknown };
    const hasAFrame = Boolean(globalWindow.AFRAME);
    const alreadyReset = this.document.defaultView?.sessionStorage.getItem(this.runtimeResetStorageKey);

    // AR.js and 8th-Wall both patch A-Frame globally. In a single-page route switch,
    // that can leave incompatible registries and trigger "a[e] is not a constructor".
    // A once-per-session hard reload guarantees a clean runtime bootstrap.
    return hasAFrame && alreadyReset !== '1';
  }

  private forceCleanReload(): void {
    this.document.defaultView?.sessionStorage.setItem(this.runtimeResetStorageKey, '1');
    this.document.defaultView?.location.reload();
  }

  private clearCleanReloadMarker(): void {
    this.document.defaultView?.sessionStorage.removeItem(this.runtimeResetStorageKey);
  }

  private bindTargetEvents(): void {
    const target = this.document.getElementById('wichtel-target');
    const scene = this.document.getElementById('x8-scene');
    if (!target) {
      this.error.set('8th-Wall-Szene wurde geladen, aber das Target-Element fehlt.');
      return;
    }

    if (!scene) {
      this.error.set('8th-Wall-Szene konnte nicht gefunden werden.');
      return;
    }

    const audio = this.document.getElementById('wichtel-audio') as HTMLAudioElement | null;
    if (!audio) {
      console.warn('[8th-wall] Audio element #wichtel-audio not found.');
    }

    this.bindCelebrationLifecycle(audio);

    const onFound = (event: Event) => {
      console.info('[8th-wall] Target found event:', event.type);
      this.targetDetected.set(true);
      this.triggerCelebration(audio, event.type);
    };

    const onLost = (event: Event) => {
      console.info('[8th-wall] Target lost event:', event.type);
      this.targetDetected.set(false);
    };

    // Support multiple event names used across XR8/A-Frame helper versions.
    const foundEvents = ['xrextrasnamedimagefound', 'xrimagefound', 'targetFound', 'markerFound'];
    const lostEvents = ['xrextrasnamedimagelost', 'xrimagelost', 'targetLost', 'markerLost'];

    const addListeners = (el: Element) => {
      foundEvents.forEach((eventName) => {
        el.addEventListener(eventName, onFound as EventListener);
      });
      lostEvents.forEach((eventName) => {
        el.addEventListener(eventName, onLost as EventListener);
      });
    };

    const removeListeners = (el: Element) => {
      foundEvents.forEach((eventName) => {
        el.removeEventListener(eventName, onFound as EventListener);
      });
      lostEvents.forEach((eventName) => {
        el.removeEventListener(eventName, onLost as EventListener);
      });
    };

    addListeners(target);
    addListeners(scene);
    const stopVisibilityMonitor = this.startTargetVisibilityMonitor(target as HTMLElement, onFound, onLost);

    this.teardownFns.push(() => {
      removeListeners(target);
      removeListeners(scene);
      stopVisibilityMonitor();
    });
  }

  private bindCelebrationLifecycle(audio: HTMLAudioElement | null): void {
    const modelEntity = this.document.getElementById('wichtel-model') as
      | (HTMLElement & {
          getObject3D?: (name: string) => unknown;
        })
      | null;

    const rootEntity = this.document.getElementById('wichtel-celebration-root') as
      | (HTMLElement & {
          setAttribute: (name: string, value: unknown) => void;
        })
      | null;

    const onModelLoaded = (event: Event) => {
      const modelEvent = event as CustomEvent<{ model?: { animations?: any[] } }>;
      this.celebrationModelLoaded = true;
      this.celebrationAnimationHost = modelEvent.detail?.model ?? modelEntity?.getObject3D?.('mesh') ?? null;
      this.celebrationAnimations = this.celebrationAnimationHost?.animations ?? [];

      if (this.celebrationPendingStart) {
        this.startCelebrationPlayback(audio, rootEntity);
      }
    };

    const onAudioEnded = () => {
      this.finishCelebration(rootEntity);
    };

    modelEntity?.addEventListener('model-loaded', onModelLoaded as EventListener);
    audio?.addEventListener('ended', onAudioEnded as EventListener);

    this.teardownFns.push(() => {
      modelEntity?.removeEventListener('model-loaded', onModelLoaded as EventListener);
      audio?.removeEventListener('ended', onAudioEnded as EventListener);
    });
  }

  private triggerCelebration(audio: HTMLAudioElement | null, triggerEvent: string): void {
    if (this.celebrationRunning || this.celebrationPendingStart) {
      console.info('[8th-wall] Celebration already active. Ignoring trigger:', triggerEvent);
      return;
    }

    this.celebrationPendingStart = true;

    const rootEntity = this.document.getElementById('wichtel-celebration-root') as
      | (HTMLElement & {
          setAttribute: (name: string, value: unknown) => void;
        })
      | null;

    rootEntity?.setAttribute('visible', true);
    this.celebrationVisible.set(true);
    this.celebrationBusy.set(true);

    if (this.celebrationModelLoaded) {
      this.startCelebrationPlayback(audio, rootEntity);
    }
  }

  private startCelebrationPlayback(
    audio: HTMLAudioElement | null,
    rootEntity: ({ setAttribute: (name: string, value: unknown) => void } & HTMLElement) | null,
  ): void {
    if (!this.celebrationPendingStart || this.celebrationRunning) {
      return;
    }

    this.celebrationPendingStart = false;
    this.celebrationRunning = true;
    this.celebrationBusy.set(true);
    rootEntity?.setAttribute('visible', true);

    this.playCelebrationAnimation();

    if (!audio) {
      return;
    }

    this.unlockAudio().catch(() => {
      // Manual button remains available as fallback.
    });

    audio.currentTime = 0;
    audio.play().catch((err) => {
      console.warn('[8th-wall] Celebration audio play blocked:', err);
      this.finishCelebration(rootEntity);
    });
  }

  private playCelebrationAnimation(): void {
    const threeWindow = window as unknown as {
      THREE?: {
        AnimationMixer: new (root: any) => any;
        LoopOnce?: unknown;
      };
    };

    if (!threeWindow.THREE || !this.celebrationAnimationHost || this.celebrationAnimations.length === 0) {
      return;
    }

    this.stopCelebrationAnimationTicker();

    this.celebrationMixer = new threeWindow.THREE.AnimationMixer(this.celebrationAnimationHost);
    this.celebrationAnimations.forEach((clip) => {
      const action = this.celebrationMixer.clipAction(clip);
      if (threeWindow.THREE?.LoopOnce !== undefined) {
        action.setLoop(threeWindow.THREE.LoopOnce, 1);
      }
      action.clampWhenFinished = true;
      action.reset();
      action.play();
    });

    const tick = (now: number) => {
      if (!this.celebrationMixer) {
        return;
      }

      const deltaSeconds = this.celebrationLastTickMs === null ? 0 : Math.max(0, (now - this.celebrationLastTickMs) / 1000);
      this.celebrationLastTickMs = now;
      this.celebrationMixer.update(deltaSeconds);
      this.celebrationTickId = this.document.defaultView?.requestAnimationFrame(tick) ?? null;
    };

    this.celebrationLastTickMs = null;
    this.celebrationTickId = this.document.defaultView?.requestAnimationFrame(tick) ?? null;
  }

  private stopCelebrationAnimationTicker(): void {
    if (typeof this.celebrationTickId === 'number') {
      this.document.defaultView?.cancelAnimationFrame(this.celebrationTickId);
      this.celebrationTickId = null;
    }

    if (this.celebrationMixer) {
      this.celebrationMixer.stopAllAction();
      this.celebrationMixer = null;
    }

    this.celebrationLastTickMs = null;
  }

  private finishCelebration(
    rootEntity: ({ setAttribute: (name: string, value: unknown) => void } & HTMLElement) | null,
  ): void {
    this.stopCelebrationAnimationTicker();
    this.celebrationRunning = false;
    this.celebrationPendingStart = false;
    this.celebrationVisible.set(false);
    this.celebrationBusy.set(false);
    rootEntity?.setAttribute('visible', false);
  }

  private startTargetVisibilityMonitor(
    target: HTMLElement,
    onFound: (event: Event) => void,
    onLost: (event: Event) => void,
  ): () => void {
    let wasVisible = this.isTargetCurrentlyVisible(target);

    const intervalId = this.document.defaultView?.setInterval(() => {
      const isVisible = this.isTargetCurrentlyVisible(target);
      if (isVisible === wasVisible) {
        return;
      }

      wasVisible = isVisible;
      if (isVisible) {
        onFound(new CustomEvent('targetVisibleStateFound'));
      } else {
        onLost(new CustomEvent('targetVisibleStateLost'));
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
    if (typeof object3DVisible === 'boolean') {
      return object3DVisible;
    }

    const visibleAttr = targetEntity.getAttribute('visible');
    return visibleAttr !== 'false';
  }

  private registerAudioUnlockHooks(): void {
    const view = this.document.defaultView;
    if (!view || this.audioPrimed) {
      return;
    }

    const unlock = () => {
      this.unlockAudio().catch(() => {
        // Intentionally ignore; manual button remains available.
      });
    };

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchstart', 'keydown'];
    events.forEach((eventName) => {
      view.addEventListener(eventName, unlock, { once: true, passive: true });
    });

    this.teardownFns.push(() => {
      events.forEach((eventName) => {
        view.removeEventListener(eventName, unlock);
      });
    });
  }

  private waitForSceneReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const scene = this.document.getElementById('x8-scene') as
        | (HTMLElement & { hasLoaded?: boolean })
        | null;
      if (!scene) {
        reject(new Error('8th-Wall scene element not found.'));
        return;
      }

      if (scene.hasLoaded) {
        resolve();
        return;
      }

      const onLoaded = () => {
        scene.removeEventListener('loaded', onLoaded as EventListener);
        resolve();
      };

      scene.addEventListener('loaded', onLoaded as EventListener, { once: true });
    });
  }

  private waitForSceneElement(): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = this.document.getElementById('x8-scene');
      if (existing) {
        resolve();
        return;
      }

      const observer = new MutationObserver(() => {
        const scene = this.document.getElementById('x8-scene');
        if (scene) {
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(this.document.body, { childList: true, subtree: true });

      this.document.defaultView?.setTimeout(() => {
        observer.disconnect();
        reject(new Error('8th-Wall scene element was not rendered.'));
      }, 5000);
    });
  }

  private stopRuntime(): void {
    this.teardownFns.forEach((fn) => fn());
    this.teardownFns = [];

    const audio = this.document.getElementById('wichtel-audio') as HTMLAudioElement | null;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    const celebrationRoot = this.document.getElementById('wichtel-celebration-root') as
      | (HTMLElement & {
          setAttribute: (name: string, value: unknown) => void;
        })
      | null;
    this.finishCelebration(celebrationRoot);

    const xr8 = (window as unknown as { XR8?: { stop?: () => void } }).XR8;
    if (
      this.cameraFeedMonitorRegistered &&
      xr8 &&
      typeof (xr8 as { removeCameraPipelineModule?: (name: string) => void }).removeCameraPipelineModule === 'function'
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

  private async patchBestRearCameraIfAvailable(): Promise<void> {
    const shouldForceRearCamera = this.cameraService.isSamsungInternetBrowser();
    if (!shouldForceRearCamera) {
      return;
    }

    if (this.originalGetUserMedia) {
      return;
    }

    if (!('mediaDevices' in navigator) || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    const preferredDeviceId = await this.cameraService.getBestRearCameraId();
    if (!preferredDeviceId) {
      return;
    }

    this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const original = this.originalGetUserMedia;

    navigator.mediaDevices.getUserMedia = (constraints?: MediaStreamConstraints) => {
      const requestedVideo = constraints?.video;
      if (!requestedVideo) {
        return original(constraints);
      }

      const patchedVideo: MediaTrackConstraints =
        typeof requestedVideo === 'boolean'
          ? {
              deviceId: { exact: preferredDeviceId },
              facingMode: { ideal: 'environment' },
            }
          : {
              ...requestedVideo,
              deviceId: { exact: preferredDeviceId },
              facingMode: { ideal: 'environment' },
            };

      return original({
        ...constraints,
        video: patchedVideo,
      });
    };
  }

  private restoreGetUserMedia(): void {
    if (!this.originalGetUserMedia || !navigator.mediaDevices) {
      return;
    }

    navigator.mediaDevices.getUserMedia = this.originalGetUserMedia;
    this.originalGetUserMedia = null;
  }

  private loadScriptOnce(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = this.document.querySelector(`script[data-runtime-src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }

      const script = this.document.createElement('script');
      script.src = src;
      script.async = true;
      if (src.includes('/8thwall/xr.js')) {
        // Mirror the official sample setup so XR8 preloads the SLAM runtime chunk.
        script.setAttribute('data-preload-chunks', 'slam');
      }
      script.dataset['runtimeSrc'] = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Script load failed: ${src}`));
      this.document.head.appendChild(script);
    });
  }

  private waitForXrLoaded(): Promise<void> {
    return new Promise((resolve) => {
      const runtime = this.getXrRuntime();
      if (runtime) {
        resolve();
        return;
      }

      const onLoaded = () => {
        this.document.defaultView?.removeEventListener('xrloaded', onLoaded as EventListener);
        resolve();
      };

      this.document.defaultView?.addEventListener('xrloaded', onLoaded as EventListener, {
        once: true,
      });
    });
  }

  private getXrRuntime(): any {
    const globalWindow = window as unknown as { XR8?: any };
    return globalWindow.XR8 ?? null;
  }

  private getXrController(xr8: any): any {
    return xr8?.XrController ?? xr8?.xrController ?? null;
  }

  private registerCameraFeedMonitor(xr8: any): void {
    this.xrCameraFeedObserved = false;
    this.xrCanvasVisibleObserved = false;

    if (typeof xr8?.addCameraPipelineModule !== 'function') {
      return;
    }

    xr8.addCameraPipelineModule({
      name: this.cameraFeedMonitorModuleName,
      onCameraStatusChange: ({ status }: { status?: string }) => {
        this.xrLastCameraStatus = status ?? null;
        this.logXrDiagnostic('camera-status-' + (status ?? 'unknown'), `XR camera status: ${status ?? 'unknown'}`);
        if (status === 'hasVideo') {
          this.xrCameraFeedObserved = true;
        }
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
          this.logXrDiagnostic(
            'texture-source-' + activeTextureSource,
            `XR pipeline produced ${activeTextureSource}.`,
          );
        }

        if (realityTexture || faceTexture || handTexture || layerTexture) {
          this.xrCameraFeedObserved = true;
        }
      },
    });

    this.cameraFeedMonitorRegistered = true;
  }

  private instrumentXrRun(xr8: any): void {
    if (this.xrRunInstrumented || typeof xr8?.run !== 'function') {
      return;
    }

    const originalRun = xr8.run.bind(xr8);
    xr8.run = (runConfig: Record<string, unknown>) => {
      this.xrRunObserved = true;
      this.logXrDiagnostic(
        'xr-run',
        `XR8.run invoked. keys=${Object.keys(runConfig ?? {}).join(',') || 'none'}`,
      );
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
      XRExtras?: {
        AFrame?: {
          registerXrExtrasComponents?: () => void;
        };
      };
    };

    const aframe = globalWindow.AFRAME;
    if (!aframe?.registerComponent || !xr8?.AFrame) {
      this.logXrDiagnostic('aframe-missing', 'AFRAME or XR8.AFrame was not available for explicit component registration.');
      return;
    }

    const ensureComponent = (name: string, factory: (() => unknown) | undefined) => {
      if (!factory || aframe.components?.[name]) {
        return;
      }

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
  }

  private async ensureSlamControllerReady(xr8: any): Promise<void> {
    if (this.getXrController(xr8)?.configure) {
      return;
    }

    if (typeof xr8?.loadChunk === 'function') {
      try {
        await xr8.loadChunk('slam');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const alreadyDefinedAlias = message.includes('Cannot redefine property: xrController');
        if (!alreadyDefinedAlias) {
          console.warn('[8th-wall] XR8.loadChunk("slam") failed:', err);
        }
      }
    }

    // Give XR runtime a short window to finalize chunk registration.
    for (let i = 0; i < 12; i++) {
      if (this.getXrController(xr8)?.configure) {
        return;
      }
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

  private buildXrwebConfig(): string {
    return 'disableWorldTracking: true';
  }

  private buildXrconfig(direction: 'back' | 'front'): string {
    return `allowedDevices: any; cameraDirection: ${direction}`;
  }

  private canUseDirectionFallback(): boolean {
    if (this.cameraDirectionFallbackUsed) {
      return false;
    }

    return this.getPreferredCameraDirection() === 'back';
  }

  private async waitForCameraFeed(timeoutMs: number): Promise<boolean> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const scene = this.document.getElementById('x8-scene');

      if (this.xrCameraFeedObserved) {
        this.xrCanvasVisibleObserved = true;
        return true;
      }

      if (this.xrCanvasVisibleObserved) {
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
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      stream.getTracks().forEach((track) => track.stop());
    } catch {
      // Fallback for browsers that reject facingMode constraints.
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
    const parts = [
      'Falling back to direct camera mode.',
      `xrRunObserved=${this.xrRunObserved ? 'yes' : 'no'}`,
      `lastCameraStatus=${this.xrLastCameraStatus ?? 'none'}`,
      `textureSource=${this.xrLastTextureSource ?? 'none'}`,
      `canvasVisible=${this.xrCanvasVisibleObserved ? 'yes' : 'no'}`,
      `preferredDirection=${this.cameraDirectionFallbackUsed ? 'front' : this.getPreferredCameraDirection()}`,
    ];

    return parts.join(' ');
  }

  private logXrDiagnostic(key: string, message: string): void {
    if (this.xrDiagnosticsLogged.has(key)) {
      return;
    }

    this.xrDiagnosticsLogged.add(key);
    console.info('[8th-wall][diag]', message);
  }

  private async enableDirectCameraFallback(): Promise<void> {
    this.directCameraFallbackReason.set(
      'XR-Kamerabild blieb schwarz. Direkter Webcam-Notfallmodus ist aktiv.',
    );

    if (this.directCameraStream) {
      this.directCameraFallbackActive.set(true);
      return;
    }

    this.directCameraStream = await this.acquireWorkingCameraStream();

    this.directCameraFallbackActive.set(true);

    const video = await this.waitForElementById<HTMLVideoElement>('direct-camera-video', 1500);
    if (!video) {
      return;
    }

    video.srcObject = this.directCameraStream;
    await video.play().catch((err) => {
      console.warn('[8th-wall] Direct camera fallback video play failed:', err);
    });
  }

  private async acquireWorkingCameraStream(): Promise<MediaStream> {
    const attempts = await this.buildDirectCameraAttempts();
    let firstStream: MediaStream | null = null;

    for (const videoConstraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        if (!firstStream) {
          firstStream = stream;
        }

        const hasVisibleFrames = await this.streamHasVisibleFrames(stream, 2000);
        if (hasVisibleFrames) {
          if (firstStream && firstStream !== stream) {
            firstStream.getTracks().forEach((track) => track.stop());
          }
          return stream;
        }

        if (stream !== firstStream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch {
        // Try next camera profile.
      }
    }

    if (!firstStream) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        firstStream = stream;
        const hasVisibleFrames = await this.streamHasVisibleFrames(stream, 2000);
        if (hasVisibleFrames) {
          return stream;
        }
      } catch {
        // Ignore and throw below.
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
    const preferredDirection: 'environment' | 'user' = this.cameraDirectionFallbackUsed
      ? 'user'
      : 'environment';
    const oppositeDirection: 'environment' | 'user' =
      preferredDirection === 'environment' ? 'user' : 'environment';

    const attempts: MediaTrackConstraints[] = [
      { facingMode: { ideal: preferredDirection } },
      { facingMode: { ideal: oppositeDirection } },
    ];

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === 'videoinput');

    for (const device of videoInputs) {
      attempts.push({ deviceId: { exact: device.deviceId } });
    }

    return attempts;
  }

  private async streamHasVisibleFrames(stream: MediaStream, timeoutMs: number): Promise<boolean> {
    const video = this.document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = stream;

    const loaded = await new Promise<boolean>((resolve) => {
      const onLoadedData = () => {
        cleanup();
        resolve(true);
      };

      const cleanup = () => {
        video.removeEventListener('loadeddata', onLoadedData);
        this.document.defaultView?.clearTimeout(timer);
      };

      const timer = this.document.defaultView?.setTimeout(() => {
        cleanup();
        resolve(false);
      }, Math.min(timeoutMs, 1200));

      video.addEventListener('loadeddata', onLoadedData, { once: true });
      void video.play().catch(() => {
        // Some browsers block programmatic play on detached video. We'll still try reads.
      });
    });

    if (!loaded) {
      video.srcObject = null;
      return false;
    }

    const startedAt = Date.now();
    let lastTime = video.currentTime;
    while (Date.now() - startedAt < timeoutMs) {
      if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        if (video.currentTime > lastTime || !video.paused) {
          video.srcObject = null;
          return true;
        }

        lastTime = video.currentTime;
      }

      await this.sleep(100);
    }

    video.srcObject = null;
    return false;
  }

  private disableDirectCameraFallback(): void {
    const video = this.document.getElementById('direct-camera-video') as HTMLVideoElement | null;
    if (video) {
      video.srcObject = null;
    }

    this.directCameraStream?.getTracks().forEach((track) => track.stop());
    this.directCameraStream = null;
    this.directCameraFallbackActive.set(false);
    this.directCameraFallbackReason.set(null);
  }

  private async waitForElementById<T extends HTMLElement>(id: string, timeoutMs: number): Promise<T | null> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const element = this.document.getElementById(id) as T | null;
      if (element) {
        return element;
      }

      await this.sleep(50);
    }

    return null;
  }

  private async getCameraPermissionState(): Promise<'granted' | 'prompt' | 'denied' | 'unknown'> {
    const permissionApi = (navigator as Navigator & {
      permissions?: {
        query: (descriptor: { name: string }) => Promise<{ state: string }>;
      };
    }).permissions;

    if (!permissionApi?.query) {
      return 'unknown';
    }

    try {
      const result = await permissionApi.query({ name: 'camera' });
      if (result.state === 'granted' || result.state === 'prompt' || result.state === 'denied') {
        return result.state;
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async loadImageTargetData(path: string): Promise<Record<string, unknown> | null> {
    try {
      const assetUrl = this.resolveAssetUrl(path);
      const response = await fetch(assetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${assetUrl}`);
      }
      return await response.json();
    } catch (err) {
      console.warn('[8th-wall] Failed to load image target data:', err);
      return null;
    }
  }

  private preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Image load failed: ${url}`));
      image.src = url;
    });
  }

  private resolveAssetUrl(path: string): string {
    const normalizedPath = path.replace(/^\/+/, '');
    return new URL(normalizedPath, this.document.baseURI).toString();
  }
}

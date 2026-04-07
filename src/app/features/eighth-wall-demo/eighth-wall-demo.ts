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
  selector: 'app-eighth-wall-demo',
  standalone: true,
  templateUrl: './eighth-wall-demo.html',
  styleUrl: './eighth-wall-demo.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EighthWallDemoComponent implements AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly cameraService = inject(CameraService);
  private teardownFns: Array<() => void> = [];

  private readonly runtimeScripts = [
    '8thwall/xr.js',
    '8thwall/8frame.min.js',
    '8thwall/xrextras.js',
  ];

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly showBrowserWarning = signal(false);
  protected readonly targetDetected = signal(false);
  protected readonly runtimeReady = signal(false);

  protected readonly overlayUrl = this.resolveAssetUrl('overlays/info-overlay.svg');
  protected readonly audioUrl = this.resolveAssetUrl('sounds/kuckuck.mp3');

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
    const audio = this.document.getElementById('kuckuck-audio') as HTMLAudioElement | null;
    if (!audio) return;

    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
    } catch (err) {
      console.warn('[8th-wall] Audio unlock failed:', err);
    }
  }

  private async startRuntime(): Promise<void> {
    this.stopRuntime();
    this.loading.set(true);
    this.error.set(null);
    this.targetDetected.set(false);
    this.runtimeReady.set(false);

    try {
      for (const scriptPath of this.runtimeScripts) {
        await this.loadScriptOnce(this.resolveAssetUrl(scriptPath));
      }

      const xr8 = (window as unknown as { XR8?: any }).XR8;
      if (!xr8) {
        throw new Error('XR8 runtime not found after script load.');
      }

      // Configure kuckuck image target
      const kuckuckTargetData = await this.loadImageTargetData('imagetargets/kuckuck.json');
      if (xr8.XrController && kuckuckTargetData) {
        xr8.XrController.configure({
          imageTargetData: [kuckuckTargetData],
        });
      }

      // Start 8th Wall runtime
      xr8.run?.();

      this.runtimeReady.set(true);

      // Delay event wiring to the next task so a-scene can initialize after scripts are ready.
      setTimeout(() => {
        this.bindTargetEvents();
      }, 0);
    } catch (err) {
      console.error('[8th-wall] Runtime init failed:', err);
      this.error.set(
        '8th-Wall konnte nicht gestartet werden. Stelle sicher, dass xr.js, 8frame.min.js und xrextras.js unter public/8thwall liegen.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private bindTargetEvents(): void {
    const target = this.document.getElementById('kuckuck-target');
    if (!target) {
      this.error.set('8th-Wall-Szene wurde geladen, aber das Target-Element fehlt.');
      return;
    }

    const audio = this.document.getElementById('kuckuck-audio') as HTMLAudioElement | null;

    const onFound = () => {
      this.targetDetected.set(true);
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch((err) => {
          console.warn('[8th-wall] Audio play blocked:', err);
        });
      }
    };

    const onLost = () => {
      this.targetDetected.set(false);
      audio?.pause();
    };

    // Support multiple event names used across XR8/A-Frame helper versions.
    const foundEvents = ['xrextrasnamedimagefound', 'xrimagefound', 'targetFound', 'markerFound'];
    const lostEvents = ['xrextrasnamedimagelost', 'xrimagelost', 'targetLost', 'markerLost'];

    foundEvents.forEach((eventName) => {
      target.addEventListener(eventName, onFound as EventListener);
    });
    lostEvents.forEach((eventName) => {
      target.addEventListener(eventName, onLost as EventListener);
    });

    this.teardownFns.push(() => {
      foundEvents.forEach((eventName) => {
        target.removeEventListener(eventName, onFound as EventListener);
      });
      lostEvents.forEach((eventName) => {
        target.removeEventListener(eventName, onLost as EventListener);
      });
    });
  }

  private stopRuntime(): void {
    this.teardownFns.forEach((fn) => fn());
    this.teardownFns = [];

    const audio = this.document.getElementById('kuckuck-audio') as HTMLAudioElement | null;
    audio?.pause();

    const xr8 = (window as unknown as { XR8?: { stop?: () => void } }).XR8;
    if (xr8?.stop) {
      xr8.stop();
    }
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
      script.dataset['runtimeSrc'] = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Script load failed: ${src}`));
      this.document.body.appendChild(script);
    });
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

  private resolveAssetUrl(path: string): string {
    const normalizedPath = path.replace(/^\/+/, '');
    return new URL(normalizedPath, this.document.baseURI).toString();
  }
}

import {
  Component,
  AfterViewInit,
  OnDestroy,
  CUSTOM_ELEMENTS_SCHEMA,
  signal,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CameraService } from '../../shared/services/camera.service';

@Component({
  selector: 'app-marker-demo',
  standalone: true,
  templateUrl: './marker-demo.html',
  styleUrl: './marker-demo.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkerDemoComponent implements AfterViewInit, OnDestroy {
  private readonly cameraService = inject(CameraService);

  /** Original getUserMedia — we restore it on destroy */
  private originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia | null = null;

  /** UI state */
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly showBrowserWarning = signal(false);
  protected readonly cameraReady = signal(false);

  /** All detected video devices for manual fallback picker */
  protected readonly videoDevices = signal<{ deviceId: string; label: string }[]>([]);

  /** Selected camera device ID for Samsung workaround */
  protected selectedDeviceId: string | undefined;

  async ngAfterViewInit(): Promise<void> {
    // Warn if Samsung Internet browser
    if (this.cameraService.isSamsungInternetBrowser()) {
      this.showBrowserWarning.set(true);
    }

    try {
      // List all cameras (for debug / manual picker)
      const devices = await this.cameraService.getVideoDevices();
      this.videoDevices.set(devices);
      console.log('[AR] Available cameras:', devices);

      // Get the best rear camera (Samsung multi-cam workaround)
      this.selectedDeviceId = await this.cameraService.getBestRearCameraId();
      console.log('[AR] Selected camera deviceId:', this.selectedDeviceId);

      // Monkey-patch getUserMedia BEFORE AR.js initializes the scene.
      // This forces AR.js to use the correct camera on Samsung multi-cam devices.
      if (this.selectedDeviceId) {
        this.patchGetUserMedia(this.selectedDeviceId);
      }

      this.cameraReady.set(true);
    } catch (err) {
      this.error.set('Kamera konnte nicht initialisiert werden. Bitte Berechtigung prüfen.');
      console.error('Camera init failed:', err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Called from the manual camera picker dropdown.
   * Restarts the AR scene with a different camera.
   */
  async switchCamera(deviceId: string): Promise<void> {
    this.selectedDeviceId = deviceId;
    this.cameraReady.set(false);

    // Tear down old scene
    this.destroyScene();
    this.restoreGetUserMedia();

    // Re-patch with new device and re-render
    this.patchGetUserMedia(deviceId);

    // Small delay to let Angular remove the a-scene from DOM
    await new Promise(r => setTimeout(r, 200));
    this.cameraReady.set(true);
  }

  ngOnDestroy(): void {
    this.destroyScene();
    this.restoreGetUserMedia();
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  /**
   * Intercept getUserMedia so that any call requesting { facingMode: 'environment' }
   * (which AR.js does internally) gets rewritten to use our chosen deviceId instead.
   */
  private patchGetUserMedia(forcedDeviceId: string): void {
    if (this.originalGetUserMedia) return; // already patched

    this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const original = this.originalGetUserMedia;

    navigator.mediaDevices.getUserMedia = (constraints?: MediaStreamConstraints) => {
      if (constraints?.video) {
        // Replace the video constraints to force our chosen camera
        const patched: MediaStreamConstraints = {
          ...constraints,
          video: {
            deviceId: { exact: forcedDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };
        console.log('[AR] Patched getUserMedia constraints:', patched);
        return original(patched);
      }
      return original(constraints);
    };
  }

  private restoreGetUserMedia(): void {
    if (this.originalGetUserMedia) {
      navigator.mediaDevices.getUserMedia = this.originalGetUserMedia;
      this.originalGetUserMedia = null;
    }
  }

  private destroyScene(): void {
    const scene = document.querySelector('a-scene') as any;
    if (scene?.exitVR) {
      scene.exitVR();
    }
    // Stop all video tracks to release the camera
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
      const stream = v.srcObject as MediaStream | null;
      stream?.getTracks().forEach(t => t.stop());
      v.srcObject = null;
    });
  }
}

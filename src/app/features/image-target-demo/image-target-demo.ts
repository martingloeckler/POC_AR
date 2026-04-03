import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { CameraService } from '../../shared/services/camera.service';

@Component({
  selector: 'app-image-target-demo',
  standalone: true,
  templateUrl: './image-target-demo.html',
  styleUrl: './image-target-demo.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageTargetDemoComponent implements AfterViewInit, OnDestroy {
  private readonly cameraService = inject(CameraService);

  private originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia | null = null;
  private matrixCheckInterval: number | null = null;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly showBrowserWarning = signal(false);
  protected readonly sceneReady = signal(false);
  protected readonly targetDetected = signal(false);
  protected readonly videoDevices = signal<{ deviceId: string; label: string }[]>([]);

  protected selectedDeviceId: string | undefined;

  async ngAfterViewInit(): Promise<void> {
    if (this.cameraService.isSamsungInternetBrowser()) {
      this.showBrowserWarning.set(true);
    }

    try {
      // List all cameras (for manual picker)
      const devices = await this.cameraService.getVideoDevices();
      this.videoDevices.set(devices);
      console.log('[AR-01] Available cameras:', devices);

      // Get the best rear camera (Samsung multi-cam workaround)
      this.selectedDeviceId = await this.cameraService.getBestRearCameraId();
      console.log('[AR-01] Selected camera deviceId:', this.selectedDeviceId);

      if (this.selectedDeviceId) {
        this.patchGetUserMedia(this.selectedDeviceId);
      }

      this.sceneReady.set(true);

      // Wait for A-Frame to fully initialize <a-nft> element
      this.waitForNFTElement().then(() => {
        this.bindTargetEvents();
      });
    } catch (err) {
      this.error.set('Image-Target konnte nicht initialisiert werden. Bitte Kamerazugriff prüfen.');
      console.error('Image target init failed:', err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Called from the manual camera picker dropdown.
   * Restarts the AR scene with a different camera.
   */
  async switchCamera(deviceId: string): Promise<void> {
    // Clear interval before switching
    if (this.matrixCheckInterval) {
      clearInterval(this.matrixCheckInterval);
      this.matrixCheckInterval = null;
    }

    this.selectedDeviceId = deviceId;
    this.sceneReady.set(false);

    // Tear down old scene
    this.destroyScene();
    this.restoreGetUserMedia();

    // Re-patch with new device and re-render
    this.patchGetUserMedia(deviceId);

    // Small delay to let Angular remove the a-scene from DOM
    await new Promise(r => setTimeout(r, 200));
    this.sceneReady.set(true);

    // Re-bind events after scene recreates
    this.waitForNFTElement().then(() => {
      this.bindTargetEvents();
    });
  }

  ngOnDestroy(): void {
    // Clear matrix check interval
    if (this.matrixCheckInterval) {
      clearInterval(this.matrixCheckInterval);
    }
    
    this.destroyScene();
    this.restoreGetUserMedia();
  }

  private waitForNFTElement(): Promise<void> {
    return new Promise((resolve) => {
      const nft = document.getElementById('kuckuck-nft');
      if (nft) {
        resolve();
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.getElementById('kuckuck-nft');
        if (element) {
          observer.disconnect();
          // Wait for element to be fully initialized by A-Frame
          setTimeout(() => resolve(), 200);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });

      // Safety timeout after 5 seconds
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 5000);
    });
  }

  private bindTargetEvents(): void {
    const nft = document.getElementById('kuckuck-nft');
    const audio = document.getElementById('kuckuck-audio') as HTMLAudioElement | null;
    const scene = document.querySelector('a-scene');

    if (!nft) {
      console.error('[AR-01] NFT target element not found');
      return;
    }

    if (!audio) {
      console.warn('[AR-01] Audio element not found');
    }

    console.log('[AR-01] Binding events to NFT element:', nft.tagName);

    // Handler für verschiedene Event-Namen
    const onTargetFound = () => {
      console.log('[AR-01] ✅ Target Kuckuck FOUND!');
      this.targetDetected.set(true);
      
      if (audio) {
        console.log('[AR-01] Playing audio...');
        audio.currentTime = 0;
        audio.play().catch((err) => {
          console.error('[AR-01] Audio play failed:', err);
        });
      }
    };

    const onTargetLost = () => {
      console.log('[AR-01] ❌ Target Kuckuck LOST');
      this.targetDetected.set(false);
      
      if (audio) {
        audio.pause();
      }
    };

    // Bind mehrere Event-Namen auf NFT-Element
    nft.addEventListener('markerFound', onTargetFound);
    nft.addEventListener('markerLost', onTargetLost);
    nft.addEventListener('targetFound', onTargetFound);
    nft.addEventListener('targetLost', onTargetLost);

    // Auch auf Scene binden (AR.js NFT emittiert oft auf root-Element)
    if (scene) {
      scene.addEventListener('markerFound', onTargetFound);
      scene.addEventListener('markerLost', onTargetLost);
      scene.addEventListener('targetFound', onTargetFound);
      scene.addEventListener('targetLost', onTargetLost);
      
      // Spezielle AR.js Events
      (scene as any).addEventListener('ar-camera-init', () => {
        console.log('[AR-01] AR camera initialized');
      });
    }

    // Debugging: Hook ins ARController wenn vorhanden
    this.setupARDebugHooks(audio);
    
    console.log('[AR-01] Listening for: markerFound, markerLost, targetFound, targetLost');
  }

  private setupARDebugHooks(audio: HTMLAudioElement | null): void {
    // Versuche auf globale AR.js Objekte zuzugreifen
    if ((window as any).ARController) {
      console.log('[AR-01] ARController found, setting up debug hooks');
      const origOnDetection = (window as any).ARController.prototype.onDetection;
      
      if (origOnDetection) {
        (window as any).ARController.prototype.onDetection = function(detections: any) {
          if (detections && detections.length > 0) {
            console.log('[AR-01] 🎯 AR.js detection callback fired!', detections);
          }
          return origOnDetection.call(this, detections);
        };
      }
    }

    // Alternative: Hook die Native AR.js Event-Emission
    if ((window as any).THREEx && (window as any).THREEx.ArToolkitContext) {
      console.log('[AR-01] THREEx.ArToolkitContext available for hooks');
    }

    // **NEUE Strategie: Monitor Matrix-Änderungen auf dem a-nft Element**
    const nft = document.getElementById('kuckuck-nft');
    if (nft) {
      let lastMatrix = nft.getAttribute('matrix');
      
      // Prüfe regelmäßig auf Matrix-Änderungen (Markierungserkennung)
      this.matrixCheckInterval = window.setInterval(() => {
        const currentMatrix = nft.getAttribute('matrix');
        
        if (currentMatrix && currentMatrix !== lastMatrix) {
          console.log('[AR-01] 🎯 MATRIX CHANGED! (Marker erkannt)', { 
            old: lastMatrix, 
            new: currentMatrix 
          });
          
          // Trigger "found" event
          if (!lastMatrix) {
            console.log('[AR-01] ✅ Target Kuckuck FOUND (via matrix)!');
            this.targetDetected.set(true);
            
            if (audio) {
              audio.currentTime = 0;
              audio.play().catch((err) => {
                console.error('[AR-01] Audio play failed:', err);
              });
            }
          }
          
          lastMatrix = currentMatrix;
        } else if (!currentMatrix && lastMatrix) {
          // Matrix wurde entfernt = Marker verloren
          console.log('[AR-01] ❌ Target Kuckuck LOST (matrix removed)!');
          this.targetDetected.set(false);
          if (audio) audio.pause();
          lastMatrix = null;
        }
      }, 100);
      
      console.log('[AR-01] Matrix monitoring started');
    }
  }

  private patchGetUserMedia(forcedDeviceId: string): void {
    if (this.originalGetUserMedia) return;

    this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const original = this.originalGetUserMedia;

    navigator.mediaDevices.getUserMedia = (constraints?: MediaStreamConstraints) => {
      const patched: MediaStreamConstraints = {
        ...constraints,
        video: {
          deviceId: { exact: forcedDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      };
      console.log('[AR-01] Patched getUserMedia constraints:', patched);
      return original(patched);
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

import { Injectable, signal } from '@angular/core';
import { AnchorTransform, Vector3, Rotation } from '../models/animal.model';

/**
 * AnchorService
 * Verwaltet die Erkennung und den Zustand des Schild-Anchors.
 * Implementiert die 1-2s Stabilisierung nach Erkennung (Anchor Locking).
 */
@Injectable({ providedIn: 'root' })
export class AnchorService {
  // Signal für den aktuellen Anchor-Transform
  private anchorTransform = signal<AnchorTransform>({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    isLocked: false,
    detectedAt: 0,
  });

  // Signal für Erkennung Status
  private isDetected = signal(false);

  // Signal für Erkennung Fehler-Log
  private lastDetectionError = signal<string | null>(null);

  // Public read-only Signals
  readonly anchorTransform$ = this.anchorTransform.asReadonly();
  readonly isDetected$ = this.isDetected.asReadonly();
  readonly lastDetectionError$ = this.lastDetectionError.asReadonly();

  private lockTimeout: ReturnType<typeof setTimeout> | null = null;
  private lockDurationMs = 1500; // 1.5s stabilization time

  /**
   * Initialisiere einen neuen Anchor (wenn Schild erkannt wird)
   */
  detectAnchor(position: Vector3, rotation: Rotation): void {
    this.isDetected.set(true);
    this.lastDetectionError.set(null);

    // Setze Position/Rotation sofort
    this.anchorTransform.update(a => ({
      ...a,
      position: { ...position },
      rotation: { ...rotation },
      detectedAt: Date.now(),
    }));

    // Starte Lock-Timer
    this.scheduleLock();
  }

  /**
   * Zeitsteuerung: Anchor wird nach lockDurationMs als "locked" markiert
   */
  private scheduleLock(): void {
    // Clearen Sie alte Timer
    if (this.lockTimeout) clearTimeout(this.lockTimeout);

    // Setzen Sie locked zu false zuerst
    this.anchorTransform.update(a => ({ ...a, isLocked: false }));

    // Nach lockDuration als locked markieren
    this.lockTimeout = setTimeout(() => {
      this.anchorTransform.update(a => ({ ...a, isLocked: true }));
    }, this.lockDurationMs);
  }

  /**
   * Update die Anchor-Position (z.B. für Drift Correction)
   * Soft-Blend wenn bereits locked
   */
  updateAnchor(position: Vector3, rotation: Rotation, blend = false): void {
    const isLocked = this.anchorTransform().isLocked;

    if (blend && isLocked) {
      // Soft blend: linearer Übergang über 0.5s (optional)
      const blendFactor = 0.2; // 20% zu new, 80% zu old
      this.anchorTransform.update(a => ({
        ...a,
        position: {
          x: a.position.x * (1 - blendFactor) + position.x * blendFactor,
          y: a.position.y * (1 - blendFactor) + position.y * blendFactor,
          z: a.position.z * (1 - blendFactor) + position.z * blendFactor,
        },
        rotation: {
          x: a.rotation.x * (1 - blendFactor) + rotation.x * blendFactor,
          y: a.rotation.y * (1 - blendFactor) + rotation.y * blendFactor,
          z: a.rotation.z * (1 - blendFactor) + rotation.z * blendFactor,
        },
      }));
    } else {
      // Hard update
      this.anchorTransform.update(a => ({
        ...a,
        position: { ...position },
        rotation: { ...rotation },
      }));
    }
  }

  /**
   * Schild verloren (Tracking Loss)
   */
  loseAnchor(): void {
    this.isDetected.set(false);
    this.anchorTransform.update(a => ({ ...a, isLocked: false }));
    if (this.lockTimeout) clearTimeout(this.lockTimeout);
  }

  /**
   * Anchor-Position abrufen
   */
  getAnchorPosition(): Vector3 {
    return { ...this.anchorTransform().position };
  }

  /**
   * Anchor-Rotation abrufen
   */
  getAnchorRotation(): Rotation {
    return { ...this.anchorTransform().rotation };
  }

  /**
   * Check ob Anchor locked ist
   */
  isAnchorLocked(): boolean {
    return this.anchorTransform().isLocked;
  }

  /**
   * Lockierungs-Dauer in ms (kann konfiguriert werden)
   */
  setLockDuration(ms: number): void {
    this.lockDurationMs = ms;
  }

  /**
   * Cleanup (bei Destroy)
   */
  reset(): void {
    if (this.lockTimeout) clearTimeout(this.lockTimeout);
    this.isDetected.set(false);
    this.anchorTransform.set({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      isLocked: false,
      detectedAt: 0,
    });
    this.lastDetectionError.set(null);
  }

  /**
   * Error Logging für Debugging
   */
  recordError(error: string): void {
    this.lastDetectionError.set(error);
    console.warn(`Anchor Error: ${error}`);
  }
}

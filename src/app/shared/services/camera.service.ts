import { Injectable } from '@angular/core';

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  kind: string;
}

/**
 * Service to enumerate cameras and select the best rear camera.
 * Samsung multi-camera phones often default to the wrong lens (ToF / ultra-wide).
 * This service provides a heuristic to pick the main rear camera.
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  /**
   * Returns all available video input devices.
   * Requires a prior getUserMedia call to get labels on most browsers.
   */
  async getVideoDevices(): Promise<CameraDeviceInfo[]> {
    // Request a minimal stream first so that device labels become available
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      tempStream.getTracks().forEach(track => track.stop());
    } catch {
      // Permission denied or no camera — we'll still try enumerateDevices
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter(d => d.kind === 'videoinput')
      .map(d => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
        kind: d.kind,
      }));
  }

  /**
   * Heuristic: pick the best rear camera.
   *
   * Strategy (Samsung-safe):
   * 1. Filter devices whose label contains "back" or "rear" or "environment" (case-insensitive).
   * 2. Exclude devices whose label contains "wide", "tof", "depth", "infrared", "ir ".
   * 3. From the remaining, prefer the one whose label contains "main" or pick the LAST one
   *    (on many Samsung devices the main camera is listed last among rear cameras).
   * 4. Fallback: return the first environment-facing device or undefined.
   */
  async getBestRearCameraId(): Promise<string | undefined> {
    const all = await this.getVideoDevices();

    const rearCameras = all.filter(d => {
      const label = d.label.toLowerCase();
      return label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('camera2 0') || label.includes('camera 0');
    });

    const excludePatterns = ['wide', 'tof', 'depth', 'infrared', 'ir ', 'ultra'];
    const filtered = rearCameras.filter(d => {
      const label = d.label.toLowerCase();
      return !excludePatterns.some(p => label.includes(p));
    });

    // Prefer "main" camera if labeled
    const main = filtered.find(d => d.label.toLowerCase().includes('main'));
    if (main) return main.deviceId;

    // Pick last remaining rear camera (Samsung heuristic)
    if (filtered.length > 0) return filtered[filtered.length - 1].deviceId;

    // Fallback to any rear camera
    if (rearCameras.length > 0) return rearCameras[rearCameras.length - 1].deviceId;

    // Ultimate fallback: first camera at all
    return all.length > 0 ? all[0].deviceId : undefined;
  }

  /**
   * Check if Samsung Internet browser is being used.
   */
  isSamsungInternetBrowser(): boolean {
    return /SamsungBrowser/i.test(navigator.userAgent);
  }
}

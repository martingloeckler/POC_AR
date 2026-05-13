import { Injectable } from '@angular/core';
import { Vector3 } from '../models/animal.model';

/**
 * PlacementService
 * Verwaltet die Raycast-Logik und Grid-Snap für Tier-Platzierung
 * Wird im Editor verwendet um Tiere interaktiv zu platzieren
 */
@Injectable({ providedIn: 'root' })
export class PlacementService {
  private gridSize = 0.5; // 0.5m default grid

  /**
   * Raycast vom Screen-Point in der A-Frame Szene
   * Findet die Intersection mit einer horizontalen Ebene
   *
   * @param screenX - Screen X coordinate (in pixel)
   * @param screenY - Screen Y coordinate (in pixel)
   * @param planeY - Y-Höhe der Ebene (default 0 = Boden)
   * @param canvas - HTML Canvas Element
   * @returns Position im AR-Raum oder null
   */
  raycastToPlane(
    screenX: number,
    screenY: number,
    canvas: HTMLCanvasElement,
    planeY: number = 0
  ): Vector3 | null {
    try {
      // Normalisierte Device Coordinates (NDC)
      const x = (screenX / canvas.clientWidth) * 2 - 1;
      const y = -(screenY / canvas.clientHeight) * 2 + 1;

      // In idealem Fall würden wir THREE.Raycaster hier nutzen
      // aber für MVP: vereinfachte Berechnung basierend auf Bildschirm-Position
      // Diese würde später mit echtem THREE.Raycaster ersetzt

      // Placeholder: Geben Sie Position basierend auf Screen-Position zurück
      // (später: echter Raycast gegen A-Frame Scene)
      const worldPos: Vector3 = {
        x: x * 3, // Skalierung für realistischere Werte
        y: planeY,
        z: -2 + y * 2, // Depth basierend auf Y
      };

      return worldPos;
    } catch (error) {
      console.error('Raycast failed:', error);
      return null;
    }
  }

  /**
   * Grid-Snap: Runde Position auf nächsten Grid-Punkt
   * @param position - Original Position
   * @param gridSize - Grid-Größe (default 0.5m)
   * @returns Gesnappte Position
   */
  snapToGrid(position: Vector3, gridSize?: number): Vector3 {
    const grid = gridSize ?? this.gridSize;

    return {
      x: Math.round(position.x / grid) * grid,
      y: Math.round(position.y / grid) * grid,
      z: Math.round(position.z / grid) * grid,
    };
  }

  /**
   * Konvertiere World-Space zu Anchor-Space (relativ zum Schild)
   * Dies ist essentiell, weil alle Positionen RELATIV zum Anchor gespeichert werden
   *
   * @param worldPosition - Position im World-Space
   * @param anchorPosition - Ankerpunkt
   * @returns Position relativ zum Anchor
   */
  worldToAnchorSpace(worldPosition: Vector3, anchorPosition: Vector3): Vector3 {
    return {
      x: worldPosition.x - anchorPosition.x,
      y: worldPosition.y - anchorPosition.y,
      z: worldPosition.z - anchorPosition.z,
    };
  }

  /**
   * Konvertiere Anchor-Space zurück zu World-Space
   * @param anchorPosition - Position relativ zum Anchor
   * @param anchorOrigin - Ankerpunkt im World-Space
   * @returns Position im World-Space
   */
  anchorToWorldSpace(anchorPosition: Vector3, anchorOrigin: Vector3): Vector3 {
    return {
      x: anchorPosition.x + anchorOrigin.x,
      y: anchorPosition.y + anchorOrigin.y,
      z: anchorPosition.z + anchorOrigin.z,
    };
  }

  /**
   * Lege Grid-Größe fest
   */
  setGridSize(size: number): void {
    if (size > 0) {
      this.gridSize = size;
    }
  }

  /**
   * Hole aktuelle Grid-Größe
   */
  getGridSize(): number {
    return this.gridSize;
  }

  /**
   * Hilfsfunktion: Berechne Distanz zwischen zwei Punkten (für Validierung)
   */
  distance(p1: Vector3, p2: Vector3): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Validiere ob Position innerhalb erlaubter Spielzone ist
   * (Spec: 2-15m Radius um Schild)
   */
  isWithinGameZone(position: Vector3, maxRadius: number = 15): boolean {
    const distance = this.distance(position, { x: 0, y: 0, z: 0 }); // Anchor = 0,0,0
    return distance <= maxRadius;
  }
}

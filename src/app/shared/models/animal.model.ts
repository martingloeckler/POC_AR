/**
 * AR-Tier-Spiel Datenmodelle
 * Koordinatensystem: Meter-basiert (1 Unit = 1 Meter)
 * Ursprung (0,0,0) = Schild-Ankerpunkt
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  x: number;
  y: number;
  z: number;
}

/**
 * Animal Placement Datenstruktur
 * Alle Positionen sind RELATIV zum Schild-Anchor
 */
export interface Animal {
  id: string;                              // unique ID: "deer_01"
  name: string;                            // Display Name: "Hirsch"
  type: string;                            // Animal Type: "deer", "wolf", "bird", etc.
  modelUrl: string;                        // Path to GLB: "models/animals/deer.glb"
  audioUrl?: string;                       // Optional sound: "sounds/animals/deer.mp3"
  position: Vector3;                       // X, Y, Z relativ zum Anchor (Meter)
  rotation: Rotation;                      // Euler angles in degrees (X, Y, Z)
  scale: number;                           // Uniform scale: 1.0 = normal size
}

/**
 * Level = Collection of animals placed relative to a shield anchor
 * Persistierbar in LocalStorage
 */
export interface Level {
  id: string;                              // Unique Level ID
  anchorId: string;                        // Reference to shield/anchor: "wichtel", "kuckuck"
  name?: string;                           // Display name
  animals: Animal[];                       // All placed animals
  createdAt: number;                       // Timestamp (ms)
  updatedAt?: number;
  version: number;                         // Version for migrations
}

/**
 * Anchor Transform = Position + Rotation of detected shield
 * Initialisiert bei Image Target Erkennung
 */
export interface AnchorTransform {
  position: Vector3;
  rotation: Rotation;
  isLocked: boolean;                       // True nach 1-2s stabiler Erkennung
  detectedAt: number;                      // Timestamp first detected
}

/**
 * Catalog Entry = Animal template (nicht platziert, sondern Vorlage)
 */
export interface AnimalCatalogEntry extends Animal {
  description?: string;
  category?: string;                       // "forest", "water", etc.
}

/**
 * Animal Placement Info für UI (erweitert Animal mit extra metadata)
 */
export interface AnimalPlacedUI extends Animal {
  isSelected?: boolean;
  isDragging?: boolean;
}

import { Injectable, signal } from '@angular/core';
import { AnimalCatalogEntry } from '../models/animal.model';

/**
 * AnimalCatalogService
 * In-Memory Registry der verfügbaren Tiere (Vorlagen)
 * Wird für die Animal-Auswahl im Editor genutzt
 */
@Injectable({ providedIn: 'root' })
export class AnimalCatalogService {
  // Default Animal Library
  private readonly DEFAULT_CATALOG: AnimalCatalogEntry[] = [
    {
      id: 'mushroom_template',
      name: 'Pilz',
      type: 'mushroom',
      modelUrl: 'models/MushroomJubel.glb',
      audioUrl: '',
      description: 'Ein fröhlicher Pilz',
      category: 'forest',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 0.5,
    },
  ];

  private catalog = signal<AnimalCatalogEntry[]>(this.DEFAULT_CATALOG);

  readonly catalog$ = this.catalog.asReadonly();

  /**
   * Hole alle verfügbaren Tiere im Katalog
   */
  getAvailableAnimals(): AnimalCatalogEntry[] {
    return this.catalog();
  }

  /**
   * Hole ein bestimmtes Tier-Template
   */
  getAnimal(id: string): AnimalCatalogEntry | undefined {
    return this.catalog().find(a => a.id === id);
  }

  /**
   * Erstelle eine Instanz eines Templates mit eindeutiger ID
   * (diese wird beim Platzieren verwendet)
   */
  instantiateAnimal(templateId: string, positionIndex: number = 0): any {
    const template = this.getAnimal(templateId);
    if (!template) return null;

    return {
      ...template,
      id: `placed_${templateId}_${Date.now()}_${positionIndex}`,
      // Position wird später durch Platzierungs-UI gesetzt
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    };
  }

  /**
   * Registriere ein neues Tier-Template (für Future-Erweiterungen)
   */
  registerAnimal(animal: AnimalCatalogEntry): void {
    this.catalog.update(c => {
      // Ersetze wenn bereits vorhanden, sonst füge hinzu
      const exists = c.some(a => a.id === animal.id);
      return exists ? c.map(a => (a.id === animal.id ? animal : a)) : [...c, animal];
    });
  }

  /**
   * Zurücksetzen auf Standard-Katalog
   */
  resetToDefault(): void {
    this.catalog.set(this.DEFAULT_CATALOG);
  }
}

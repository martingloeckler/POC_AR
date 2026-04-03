# Framework-Bewertung – Web-AR für den PoC

## 1. Ausgangslage
- Bestehendes Projekt: **Angular 21** / TypeScript 5.9 / Vitest
- Ziel: Browser-basierte AR auf Samsung-Geräten (kein App-Store)
- Anforderungen: AR-01 bis AR-04 gemäß [Anforderungskatalog](anforderungskatalog-web-ar.md)

## 2. Bewertete Frameworks

### 2.1 MindAR.js
- **Typ:** Open Source (MIT), kostenlos
- **Stärke:** Exzellentes bildbasiertes Image-Target-Tracking (Computer-Vision im Browser via WASM/TensorFlow.js)
- **3D-Engine:** Three.js oder A-Frame
- **Integration:** Vanilla JS/TS – lässt sich in Angular-Komponenten wrappen

| Anforderung | Abdeckung | Bemerkung |
|---|---|---|
| AR-01 Image Target | **Ja** | Kernfeature, hohe Tracking-Qualität |
| AR-02 3D + Audio | **Ja** | Über Three.js (glTF-Animationen) + Web Audio API |
| AR-03 Image Overlay | **Ja** | 2D/3D auf Image Targets |
| AR-03 Marker Overlay | **Nein** | Kein klassisches Marker-Tracking (Hiro/Barcode) |
| AR-04 Geo-Targeting | **Nein** | Nicht enthalten |

### 2.2 AR.js
- **Typ:** Open Source (MIT), kostenlos
- **Stärke:** Marker-Tracking (Hiro, Barcode, Custom) + Location-Based AR (Geo)
- **3D-Engine:** A-Frame (+ Three.js unter der Haube)
- **Integration:** Deklarativ (HTML-Tags) oder programmatisch via A-Frame; Angular-Integration über Custom Elements

| Anforderung | Abdeckung | Bemerkung |
|---|---|---|
| AR-01 Image Target | **Teilweise** | NFT-Modus vorhanden, aber Tracking-Qualität schwächer als MindAR |
| AR-02 3D + Audio | **Ja** | Über A-Frame-Entities + Sound-Komponenten |
| AR-03 Image Overlay | **Teilweise** | Über NFT, weniger stabil |
| AR-03 Marker Overlay | **Ja** | Kernfeature (Hiro, Barcode, Custom Pattern) |
| AR-04 Geo-Targeting | **Ja** | Eingebautes Location-Based-AR-Modul |

### 2.3 8th Wall (Niantic)
- **Typ:** Kommerziell (Pay-per-Session / Subscription)
- **Stärke:** Beste Gesamtqualität für Web-AR; SLAM, Image Tracking, World Tracking, VPS (Geo)
- **3D-Engine:** Three.js, A-Frame, Babylon.js, PlayCanvas
- **Integration:** SDK als Script-Tag; Framework-agnostisch

| Anforderung | Abdeckung | Bemerkung |
|---|---|---|
| AR-01 Image Target | **Ja** | Exzellent, industrietauglich |
| AR-02 3D + Audio | **Ja** | Volle Unterstützung inkl. Animationen |
| AR-03 Image Overlay | **Ja** | Hochwertig |
| AR-03 Marker Overlay | **Ja** | Über Image Targets abbildbar |
| AR-04 Geo-Targeting | **Ja** | VPS + Lightship-Plattform |

> **Nachteil:** Kosten (ab ca. 100 $/Monat oder per Session), Vendor Lock-in.

### 2.4 WebXR Device API (nativ)
- **Typ:** Browser-Standard (W3C)
- **Stärke:** Zukunftssicher, keine externe Bibliothek für Grundfunktionen
- **3D-Engine:** Three.js / Babylon.js

| Anforderung | Abdeckung | Bemerkung |
|---|---|---|
| AR-01 Image Target | **Nein** | Image Tracking experimentell, auf Samsung Internet nicht zuverlässig verfügbar |
| AR-02 3D + Audio | **Ja** | Über Three.js / Babylon.js |
| AR-03 Overlay | **Nein** | Kein stabiles Target-Tracking im Standard |
| AR-04 Geo-Targeting | **Nein** | Nicht im Scope der API |

> **Fazit:** Zu früh für eure Anforderungen; Image-/Marker-Tracking fehlt als stabiles Feature.

### 2.5 ZapWorks (Zappar)
- **Typ:** Kommerziell (Free Tier + Paid)
- **Stärke:** Sehr solides Image Tracking + eigene Zappar-Codes als Marker
- **3D-Engine:** Three.js-Integration (Universal AR SDK)

| Anforderung | Abdeckung | Bemerkung |
|---|---|---|
| AR-01 Image Target | **Ja** | Gute Qualität |
| AR-02 3D + Audio | **Ja** | Three.js-basiert |
| AR-03 Image Overlay | **Ja** | Stabil |
| AR-03 Marker Overlay | **Teilweise** | Nur Zappar-eigene Codes, kein Hiro/Barcode |
| AR-04 Geo-Targeting | **Nein** | Nicht enthalten |

## 3. Gesamtvergleich – Deckungsmatrix

| Framework | AR-01 Image | AR-02 3D+Audio | AR-03 Image Overlay | AR-03 Marker Overlay | AR-04 Geo | Open Source | Angular-kompatibel |
|---|---|---|---|---|---|---|---|
| **MindAR.js** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **AR.js** | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| **8th Wall** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **WebXR API** | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **ZapWorks** | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ✅ |

✅ = erfüllt | ⚠️ = teilweise/eingeschränkt | ❌ = nicht abgedeckt

## 4. Empfehlung

### Primärempfehlung: MindAR.js + AR.js (Kombi-Ansatz)
**Warum:** Kein einzelnes Open-Source-Framework deckt alle vier Schwerpunkte vollständig ab. Die Kombination aus MindAR.js (bestes Image-Target-Tracking) und AR.js (Marker-Tracking + Geo) deckt **alle MUSS- und SOLL-Anforderungen** ab.

**Architektur-Skizze:**
```
Angular 21 (Host-App)
├── Shared: Three.js (3D-Rendering, Animationen, Audio)
├── Modul A: MindAR.js → Image-Target-Tracking (AR-01, AR-03 Image)
├── Modul B: AR.js → Marker-Tracking (AR-03 Marker)
└── Modul C: AR.js Location → Geo-Targeting (AR-04)
```

**Vorteile:**
- Beide Bibliotheken sind Open Source (MIT) und kostenlos.
- Beide nutzen Three.js / A-Frame als 3D-Layer → gemeinsame Asset-Pipeline (glTF).
- Integration in Angular über Wrapper-Komponenten (Canvas + TypeScript-Service).
- Modularer Aufbau: jeder Schwerpunkt ist separat testbar.

**Risiken:**
- Zwei Bibliotheken bedeuten mehr Integrationsaufwand.
- AR.js NFT-Qualität muss im PoC gegen MindAR verglichen werden.

### Alternativempfehlung: 8th Wall (wenn Budget vorhanden)
**Warum:** Einzige Lösung, die alle Anforderungen mit einem einzigen SDK abdeckt. Beste Tracking-Qualität, geringster Integrationsaufwand.

**Wann sinnvoll:**
- Budget für Lizenz vorhanden (ab ~100 $/Monat).
- Schnellster Weg zum PoC-Ergebnis gewünscht.
- Langfristiger Produktionseinsatz geplant.

## 5. Bewertung Sprachwechsel (Angular vs. Alternativen)

| Kriterium | Bei Angular bleiben | Wechsel (z. B. Vanilla/React) |
|---|---|---|
| MindAR.js / AR.js Integration | ✅ Gut (Canvas-Komponente) | ✅ Gut |
| Three.js TypeScript-Support | ✅ Nativ | ✅ Nativ |
| Projektstruktur / Routing | ✅ Bereits vorhanden | ❌ Neuaufbau nötig |
| Entwickler-Produktivität | ✅ Bekanntes Setup | ⚠️ Einarbeitung |
| Bundle-Größe | ⚠️ Angular-Overhead (~80 KB) | ✅ Kleiner bei Vanilla |

**Fazit:** Ein Wechsel des Frameworks bringt **keinen relevanten Vorteil** für die AR-Anforderungen. Die AR-Bibliotheken sind framework-agnostisch und laufen in Angular genauso gut wie in React oder Vanilla JS. Der Overhead von Angular ist bei einem PoC vernachlässigbar. **Empfehlung: Bei Angular 21 bleiben.**

## 6. Empfohlene nächste Schritte
1. **Spike 1 (1–2 Tage):** MindAR.js in Angular integrieren, ein Image Target tracken, ein animiertes glTF-Modell anzeigen.
2. **Spike 2 (1 Tag):** AR.js Marker-Tracking in separater Angular-Route testen.
3. **Spike 3 (1 Tag):** AR.js Location-Based AR mit GPS-Trigger testen.
4. **Bewertung:** Ergebnisse in das [Testprotokoll](testprotokoll-web-ar.md) eintragen und Go/No-Go je Schwerpunkt ableiten.

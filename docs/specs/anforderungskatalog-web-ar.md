# Anforderungskatalog – Web-AR auf mobilen Endgeräten (Samsung-Fokus)

## 1. Zweck
Dieses Dokument definiert die Anforderungen und Akzeptanzkriterien für die technologische Exploration von browserbasierter Augmented Reality (Web-AR) auf mobilen Endgeräten mit Schwerpunkt auf Samsung-Geräten.

## 2. Zieldefinition
Ziel ist die systematische Erarbeitung und Bewertung technologischer Möglichkeiten für Web-AR auf mobilen Endgeräten (insbesondere Samsung). Die AR-Lösung soll als Webanwendung gehostet und ohne Installation einer nativen App im Browser nutzbar sein.

## 3. Rahmenbedingungen und Abgrenzung
### 3.1 Rahmenbedingungen
- Nutzung ausschließlich über Browser (keine native App-Installation).
- Fokusgeräte: Samsung-Smartphones (mindestens 2 aktuelle Modelle + 1 älteres Referenzmodell).
- Zielplattform: HTTPS-Hosting einer Webanwendung.
- Testbetrieb in realen Umgebungen (innen/außen) bei variierenden Lichtverhältnissen.

### 3.2 Nicht-Ziele
- Kein produktionsreifer Endausbau mit vollständigem UX-Feinschliff.
- Kein Store-Rollout.
- Keine plattformübergreifende Optimierung für alle Hersteller im ersten Schritt.

## 4. Funktionale Anforderungen mit Akzeptanzkriterien

### AR-01: Bildbasiertes Tracking (Image Target)
**Anforderung**
- Das System soll ein vordefiniertes Bild als Target erkennen und ein AR-Erlebnis stabil daran verankern.

**Akzeptanzkriterien (MUSS)**
- Erkennung startet nach Kamera-Freigabe innerhalb von maximal 5 Sekunden.
- Tracking bleibt bei normaler Handbewegung stabil (kein häufiges Springen).
- Wiedererkennung desselben Targets nach kurzem Verlust erfolgt innerhalb von maximal 3 Sekunden.

**Testhinweise**
- Mindestens 20 Erkennungsversuche je Gerät/Browser.
- Test unter mindestens 3 Lichtbedingungen (hell, neutral, gedimmt).

### AR-02: Animierte 3D-Objekte und Sound je Screen/State
**Anforderung**
- Das System soll animierte 3D-Objekte darstellen und kontextabhängig Audioelemente abspielen können.

**Akzeptanzkriterien (MUSS)**
- 3D-Animation startet ohne sichtbaren Fehler auf jedem Referenzgerät.
- Audio wird pro definiertem Screen/State korrekt ausgelöst.
- Audio-Playback respektiert Browser-Policies (z. B. User-Interaktion vor Autoplay).
- Gleichzeitige Darstellung von 3D + Audio führt nicht zu Funktionsabbruch.

**Testhinweise**
- Mindestens 3 Szenen/States mit unterschiedlicher Logik.
- Prüfung auf Abbrüche, Latenzen und Entkopplung zwischen Szene und Audio.

### AR-03: 2D/3D-Overlay auf Image- und Marker-Targets
**Anforderung**
- Das System soll 2D- und 3D-Inhalte sowohl auf Image Targets als auch auf Marker Targets überlagern können.

**Akzeptanzkriterien (MUSS)**
- Jeweils mindestens ein 2D- und ein 3D-Overlay pro Target-Typ nachweisbar.
- Overlays sind positionsstabil und skalieren plausibel bei Distanzänderung.
- Wechsel zwischen mehreren Targets führt nicht zu inkonsistentem Overlay-Zustand.

**Testhinweise**
- Test mit mindestens 2 unterschiedlichen Image Targets und 2 Marker Targets.
- Dokumentation von Tracking-Verlusten und Recovery-Verhalten.

### AR-04: Geo-Targeting
**Anforderung**
- Die Eignung von Geo-Targeting im Web-AR-Kontext soll evaluiert werden.

**Akzeptanzkriterien (SOLL)**
- Positionsabhängige Inhalte lassen sich auf Basis von GPS-Koordinaten auslösen.
- Technische Grenzen (Genauigkeit, Latenz, Drift) sind dokumentiert und bewertet.
- Empfehlungen für sinnvolle Einsatzszenarien sind abgeleitet (z. B. Radius-basierte Trigger).

**Testhinweise**
- Messung in mindestens 2 Outdoor-Szenarien.
- Vergleich Stand-/Bewegungsszenarien.

## 5. Nicht-funktionale Anforderungen

### NF-01: Performance
- Zielwert: stabile Darstellung ohne kritische Aussetzer während einer typischen Session.
- Beobachtungspunkte: Framerate-Verhalten, Ladezeiten von Assets, thermische Auffälligkeiten.

### NF-02: Stabilität
- Keine reproduzierbaren Abstürze in den definierten Kernszenarien.
- Fehlerfälle sollen protokolliert und klassifiziert werden (kritisch/hoch/mittel/niedrig).

### NF-03: Bedienbarkeit
- Einstieg in die AR-Funktion für Erstnutzer in höchstens 3 klaren Schritten.
- Nutzerführung für Kamera- und Standortfreigaben ist verständlich.

### NF-04: Kompatibilität
- Dokumentierte Testmatrix aus Gerät, OS-Version, Browser-Version und Ergebnisstatus.

## 6. Nachweis- und Bewertungsformat
Für jede Anforderung ist ein Ergebnis mit Evidenz zu erfassen:
- Status: Erfüllt / Teilweise erfüllt / Nicht erfüllt / Nicht bewertbar.
- Testkontext: Gerät, OS, Browser, Testdatum.
- Evidenz: Screenshots, Screenrecording, Messnotizen.
- Befund: Beobachtete Stärken, Grenzen, Risiken.
- Empfehlung: Go / Bedingt Go / No-Go für den jeweiligen Ansatz.

## 7. Ergebnis-Matrix (Template)
| ID | Anforderung | Priorität | Test durchgeführt | Status | Evidenz vorhanden | Empfehlung |
|---|---|---|---|---|---|---|
| AR-01 | Image Target Tracking | MUSS | Ja/Nein | Offen | Ja/Nein | Offen |
| AR-02 | 3D + Audio je State | MUSS | Ja/Nein | Offen | Ja/Nein | Offen |
| AR-03 | 2D/3D Overlay auf Targets | MUSS | Ja/Nein | Offen | Ja/Nein | Offen |
| AR-04 | Geo-Targeting | SOLL | Ja/Nein | Offen | Ja/Nein | Offen |

## 8. Abschlusskriterium der Exploration
Die Exploration gilt als abgeschlossen, wenn:
- alle MUSS-Anforderungen bewertet wurden,
- für alle Schwerpunkte technische Grenzen transparent dokumentiert sind,
- eine belastbare Technologieempfehlung für den nächsten Umsetzungsschritt vorliegt.

# Testprotokoll – Web-AR Exploration (Samsung-Fokus)

## 1. Dokumentinformationen
- Projekt:
- Testzyklus / Sprint:
- Testdatum:
- Tester:
- Referenz auf Anforderungskatalog: [anforderungskatalog-web-ar.md](anforderungskatalog-web-ar.md)

## 2. Testkontext (pro Lauf ausfüllen)
- Gerät (Hersteller/Modell):
- OS-Version (Android):
- Browser (Name/Version):
- Netzwerk (WLAN/4G/5G):
- Standorttyp (Indoor/Outdoor):
- Lichtbedingung (hell/neutral/gedimmt):
- Build-/Commit-Stand:

## 3. Freigaben & Startbedingungen
| Prüfschritt | Erwartung | Ergebnis (OK/NOK) | Bemerkung |
|---|---|---|---|
| HTTPS-Aufruf der Web-App | Seite lädt fehlerfrei |  |  |
| Kamera-Berechtigung | Berechtigung kann gesetzt werden |  |  |
| Audio-Berechtigung / User-Interaktion | Audio kann regelkonform gestartet werden |  |  |
| Standort-Berechtigung (für Geo-Tests) | Berechtigung kann gesetzt werden |  |  |

## 4. Testfälle nach Anforderungs-ID

### AR-01 – Bildbasiertes Tracking (Image Target)
**Soll:** Target-Erkennung und stabiles Tracking gemäß Katalog.

| TC-ID | Testschritt | Erwartung | Messwert/Beobachtung | Status (Pass/Fail/Block) | Evidenz |
|---|---|---|---|---|---|
| AR01-TC01 | Kamera freigeben, Zielbild in Sicht bringen | Erkennung ≤ 5 s | Erkennungszeit: ___ s |  |  |
| AR01-TC02 | Normale Handbewegung (10–15 s) | Tracking bleibt stabil | Jitter/Verlust: ___ |  |  |
| AR01-TC03 | Target kurz aus Sicht nehmen und wieder zeigen | Re-Detect ≤ 3 s | Wiedererkennung: ___ s |  |  |

**Serientest (mind. 20 Versuche):**
- Anzahl Versuche:
- Erfolgreich:
- Erfolgsquote (%):
- Auffälligkeiten:

### AR-02 – Animierte 3D-Objekte + Audio je Screen/State
**Soll:** 3D-Animation und Audio funktionieren pro State zuverlässig.

| TC-ID | Testschritt | Erwartung | Messwert/Beobachtung | Status (Pass/Fail/Block) | Evidenz |
|---|---|---|---|---|---|
| AR02-TC01 | Szene/State A starten | 3D startet fehlerfrei | Ladezeit: ___ s |  |  |
| AR02-TC02 | Audio in State A triggern | Korrektes Audio wird abgespielt | Latenz: ___ s |  |  |
| AR02-TC03 | Wechsel zu State B/C | Richtige Zuordnung 3D+Audio | Fehlzuordnung: Ja/Nein |  |  |
| AR02-TC04 | 3D + Audio parallel (30 s) | Kein Abbruch | Abbruch/Artefakte: ___ |  |  |

### AR-03 – 2D/3D-Overlay auf Image- und Marker-Targets
**Soll:** 2D/3D-Overlays auf beiden Target-Arten plausibel und stabil.

| TC-ID | Testschritt | Erwartung | Messwert/Beobachtung | Status (Pass/Fail/Block) | Evidenz |
|---|---|---|---|---|---|
| AR03-TC01 | 2D-Overlay auf Image Target | Overlay sichtbar und stabil | Drift/Jitter: ___ |  |  |
| AR03-TC02 | 3D-Overlay auf Image Target | Plausible Position/Skalierung | Verhalten bei Distanzänderung: ___ |  |  |
| AR03-TC03 | 2D-Overlay auf Marker Target | Overlay sichtbar und stabil | Drift/Jitter: ___ |  |  |
| AR03-TC04 | 3D-Overlay auf Marker Target | Plausible Position/Skalierung | Verhalten bei Distanzänderung: ___ |  |  |
| AR03-TC05 | Wechsel zwischen mehreren Targets | Kein inkonsistenter Zustand | Fehlerbild: ___ |  |  |

### AR-04 – Geo-Targeting (SOLL)
**Soll:** Positionsabhängige Trigger technisch bewertbar.

| TC-ID | Testschritt | Erwartung | Messwert/Beobachtung | Status (Pass/Fail/Block) | Evidenz |
|---|---|---|---|---|---|
| AR04-TC01 | Geofence/Radius definieren und betreten | Content wird ausgelöst | Trigger-Latenz: ___ s |  |  |
| AR04-TC02 | Standortwechsel in Bewegung | Trigger bleibt plausibel | Fehltrigger: ___ |  |  |
| AR04-TC03 | Standortdrift beobachten (Stand) | Grenzen dokumentierbar | Drift: ___ m |  |  |

## 5. Nicht-funktionale Beobachtungen
| Bereich | Beobachtung | Einstufung (kritisch/hoch/mittel/niedrig) | Evidenz |
|---|---|---|---|
| Performance (FPS/Ladezeiten) |  |  |  |
| Stabilität (Crash/Freeze/Recover) |  |  |  |
| Bedienbarkeit (Onboarding/Freigaben) |  |  |  |
| Kompatibilität (Gerät/Browser-spezifisch) |  |  |  |
| Thermik/Akku |  |  |  |

## 6. Defekt- und Risikoerfassung
| ID | Beschreibung | Reproduzierbarkeit | Schweregrad | Betroffene Konfiguration | Workaround |
|---|---|---|---|---|---|
| BUG- |  | immer / häufig / selten | kritisch / hoch / mittel / niedrig |  |  |

## 7. Ergebnis je Anforderung
| Anforderung | Priorität | Status (Erfüllt/Teilweise/Nicht erfüllt/Nicht bewertbar) | Kurzbegründung | Empfehlung (Go/Bedingt Go/No-Go) |
|---|---|---|---|---|
| AR-01 | MUSS |  |  |  |
| AR-02 | MUSS |  |  |  |
| AR-03 | MUSS |  |  |  |
| AR-04 | SOLL |  |  |  |

## 8. Abschlussbewertung des Testlaufs
- Gesamtfazit:
- Größte technische Stärke:
- Größte technische Einschränkung:
- Empfohlene nächste Maßnahmen (Top 3):
  1.
  2.
  3.

## 9. Kurz-Checkliste vor Abschluss
- [ ] Alle Muss-Testfälle ausgeführt oder als "nicht bewertbar" begründet
- [ ] Evidenzen (Screenshots/Recordings) verlinkt
- [ ] Ergebnisstatus AR-01 bis AR-04 gepflegt
- [ ] Go/Bedingt Go/No-Go je Anforderung gesetzt
- [ ] Nächste Maßnahmen dokumentiert

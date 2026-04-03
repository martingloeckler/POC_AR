# Marker-Assets

## Hiro-Marker (Standard für ersten Test)
Für den ersten Testlauf verwenden wir den eingebauten **Hiro-Marker** von AR.js.
Drucke diesen Marker aus oder zeige ihn auf einem zweiten Bildschirm:

https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/hiro.png

## Custom Marker erstellen (Schritt 2)
1. Öffne: https://jeromeetienne.github.io/AR.js/three.js/examples/marker-training/examples/generator.html
2. Lade ein eigenes Bild hoch
3. Lade die `.patt`-Datei herunter → speichere sie hier als `custom.patt`
4. Speichere das Marker-Bild als `custom-marker-print.png`
5. Ändere in `marker-demo.html`:
   - `<a-marker preset="hiro">` → `<a-marker type="pattern" url="markers/custom.patt">`

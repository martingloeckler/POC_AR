# 8th Wall Runtime Staging

Lege hier die offiziellen 8th-Wall-Engine-Dateien ab, bevor du sie in den Runtime-Pfad uebernimmst.

Der Ordner kann mit dem aktuell funktionierenden Bundle als Ausgangsbasis befuellt werden. Danach tauscht ihr die Dateien gezielt gegen eine neuere offizielle Version aus.

Erwartete Dateien:

- xr.js
- 8frame.min.js
- xr-slam.js
- xr-face.js

Uebernahme in das Projekt:

```bash
npm run sync:8thwall-runtime
```

Hinweise:

- Die Dateien werden nach `public/8thwall/` kopiert.
- `xrextras.js` wird nicht hier gepflegt, sondern ueber `npm run sync:xrextras`.
- Nach einem Bundle-Austausch immer `npm run build` und lokalen Kameratest ausfuehren.
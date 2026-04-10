# 8th Wall Runtime Update

Dieses Projekt trennt den 8th-Wall-Runtime-Stack in zwei Teile:

1. Engine-Dateien, manuell aus offiziellem 8th-Wall-Bundle:
   - `xr.js`
   - `8frame.min.js`
   - `xr-slam.js`
   - `xr-face.js`
2. XR Extras, aus npm:
   - `@8thwall/xrextras`
   - Sync nach `public/8thwall/xrextras.js`

## Engine-Dateien austauschen

Der Ordner `vendor/8thwall-runtime/` kann zunaechst das aktuell funktionierende Runtime-Bundle enthalten. Tauscht danach nur die Engine-Dateien aus, die aus dem offiziellen 8th-Wall-Paket kommen.

1. Offizielle Engine-Dateien nach `vendor/8thwall-runtime/` legen.
2. Dann ausfuehren:

```bash
npm run sync:8thwall-runtime
```

3. Danach validieren:

```bash
npm run sync:xrextras
npm run build
```

4. Anschliessend lokal pruefen:

- Kamerabild sichtbar
- keine neue Runtime-Fehlermeldung
- Image-Target-Tracking startet weiter korrekt

## XR Extras aktualisieren

```bash
npm install @8thwall/xrextras@latest
npm run sync:xrextras
```

## Warum diese Trennung?

- `xrextras` ist ueber npm reproduzierbar versionierbar.
- Die eigentlichen 8th-Wall-Engine-Dateien liegen in diesem Projekt als statische Vendor-Assets.
- So kann ein Engine-Update kontrolliert getestet werden, ohne die Angular-Integration erneut umbauen zu muessen.
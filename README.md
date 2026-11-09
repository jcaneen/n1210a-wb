# N1210A Weight and Balance

Installable web app (PWA) for weight and balance on Super Cub N1210A. Runs offline once installed; all data stays on the phone.

## Install on Android
1. Open the site in Chrome.
2. Menu (three dots) > Add to Home screen > Install.
3. Launch from the home screen icon. It opens full screen and works without a connection.

## Updating
Push changes to this repo. Bump `CACHE` in `sw.js` so installed phones pick up the new files on their next open.

## Files
- `index.html`, `styles.css`, `app.js`: the app
- Documents tab stores PDFs in the browser's IndexedDB on the phone; they are not part of the JSON backup
- `manifest.webmanifest`, `sw.js`, `icons/`: PWA install and offline support

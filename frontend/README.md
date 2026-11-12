# Angular Authentication Frontend

Install dependencies and run the development server from this directory:

```powershell
npm ci
npm start
```

Open <http://localhost:4200>. Development API requests use
`http://localhost:3000/api`; production builds use `/api` on the same origin.
The authentication interceptor sends cookies only to the configured API
origin. The JWT remains inaccessible to browser JavaScript.

Shop address suggestions use Google Maps JavaScript API and Places API (New).
For local development, set `googleMapsApiKey` in
`src/environments/environment.development.ts`. For deployment, provide the
restricted browser key through `public/runtime-config.js` by setting
`window.PraxioConfig.googleMapsApiKey` before serving the app. Keep the
repository copy blank and inject the deployment value during release. Browser
API keys are visible to users, so restrict them by HTTP referrer and enable
Maps JavaScript API, Places API (New), and billing in Google Cloud.

Shop repair-request directions use the server-side Google Routes API, with a
Google Directions API fallback if Routes API is disabled for the key's project.
Configure `GOOGLE_APIKEY` in `backend/.env`, enable the applicable API and
billing in Google Cloud, and keep this server key out of frontend runtime
configuration. The backend calculates the fastest driving route between saved
shop and customer coordinates and displays its road distance and travel time;
without a valid server key, enabled API, or saved locations, the page does not
show estimated route values. The map uses OpenStreetMap tiles to avoid exposing
the server key to the browser.

Run frontend tests and a production build with:

```powershell
npm test -- --watch=false
npm run build
```

See the [project README](../README.md) for backend/database setup and the
complete API flow.

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

Run frontend tests and a production build with:

```powershell
npm test -- --watch=false
npm run build
```

See the [project README](../README.md) for backend/database setup and the
complete API flow.

# NestJS Authentication API

## Setup

Copy `.env.example` to `.env`, set `MONGO_URI` to a private MongoDB Atlas
connection string, and set a random `JWT_SECRET` of at least 32 bytes. Never
commit the configured `.env` file or share the connection string.

Then run:

```powershell
npm ci
npm run start:dev
```

The API listens on `PORT` (default `3000`). Swagger is served at
`/api/docs`. See the [project README](../README.md) for Atlas network access,
database-user, frontend, and security guidance.

## Database

Mongoose schemas define the `users` collection, timestamps, password-hash
projection, and unique normalized-email index. SQL migrations are not used.
The test setup uses a local-only MongoDB URI and never reads the Atlas URI.

## Backend Checks

```powershell
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npm run lint
```

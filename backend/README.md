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

## Customer and Shop Chat

Chat uses the existing `MONGO_URI`, `JWT_SECRET`, and `FRONTEND_ORIGINS`
configuration. Messages and conversations are stored in `chat_messages` and
`chat_conversations`; binary attachments use the `chatFiles` GridFS bucket in
the configured MongoDB database. No separate storage credentials are needed.

REST endpoints (authenticated with the `access_token` cookie):

- `GET /api/chat/eligible` — repair requests and shops/customers the current
  user may contact.
- `GET /api/chat/conversations?filter=all|active|archived&search=&page=1&limit=25`
  — paginated conversations.
- `POST /api/chat/conversations` — create or reuse a conversation using
  `{ "repairRequestId": "...", "shopId": "..." }`.
- `GET /api/chat/conversations/:id` and
  `GET /api/chat/conversations/:id/messages?before=<ISO timestamp>` — authorized
  conversation details and chronological message pages (50 per page).
- `POST /api/chat/conversations/:id/messages` — persist and send text, file
  references, replies, and client-generated idempotency keys.
- `POST /api/chat/conversations/:id/attachments` — multipart `files` upload
  (up to five files, 10 MB per file).
- `GET /api/chat/conversations/:id/attachments/:fileId/download` — authorized
  attachment download.
- `PATCH /api/chat/messages/:id`, `DELETE /api/chat/messages/:id`,
  `PATCH /api/chat/conversations/:id/read`, and
  `PATCH /api/chat/conversations/:id/archive?archived=true|false`.

The authenticated Socket.IO namespace is `/chat`, using the transport endpoint
`/api/socket.io` so the existing `access_token` cookie (scoped to `/api`) is
included in browser socket handshakes. Client events are
`join_conversation`, `leave_conversation`, `send_message`, `edit_message`,
`delete_message`, `reply_message`, `mark_messages_read`, `typing_start`, and
`typing_stop`. Server events are `new_message`, `message_edited`,
`message_deleted`, `message_read`, `messages_read`, `message_delivered`,
`user_typing`, `user_stopped_typing`, `conversation_updated`, and
`unread_count_updated`. Socket connections use the same signed cookie and
allowed-origin list as the REST API; room joins and message actions verify
conversation membership server-side.

## Backend Checks

```powershell
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npm run lint
```

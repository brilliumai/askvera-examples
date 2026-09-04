# AskVERA Server Example

A minimal Express server that authenticates with the AskVERA API using **OAuth 2.0 Client Credentials** and exposes a simple REST API for the React web client.

## How it works

1. On the first API call (or 60 s before token expiry), `AskVERAClient` calls `POST /api/askvera/v1/oauth/token` with your `CLIENT_ID` + `CLIENT_SECRET`.
2. The resulting Bearer token is cached in memory and refreshed automatically.
3. Every downstream call to AskVERA includes `Authorization: Bearer <token>`.

## Setup

```sh
cp .env.example .env   # fill in the three required vars
```

**Using npm:**

```sh
npm install
npm run dev            # starts with --watch (auto-restart on changes)
```

**Using yarn:**

```sh
yarn install
yarn dev               # starts with --watch (auto-restart on changes)
```

## Endpoints exposed to the React client

| Method     | Path                         | Description                                                                                                                       |
| ---------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `POST`     | `/api/sessions/start`        | Creates user + pet + session in one call. Body: `{ firstName, lastName, email, postalCode?, petName, species, breed?, question }` |
| `GET`      | `/api/sessions/:id`          | Returns session with all messages                                                                                                 |
| `POST`     | `/api/sessions/:id/messages` | Sends a follow-up message                                                                                                         |
| `WS` `GET` | `/ws?sessionId=<id>`         | WebSocket — pushes `session.update` events                                                                                        |

### WebSocket events

Connect to `ws://localhost:3001/ws?sessionId=<id>`. The server maintains an upstream WebSocket to AskVERA and pushes `session.update` events whenever new messages arrive:

```json
{
    "type": "session.update",
    "session": {
        "id": "...",
        "sessionName": "Itchy skin on golden retriever",
        "chatSessionType": "vendor",
        "chatSessionStatus": "open",
        "messages": [
            {
                "id": "...",
                "message": "My dog has been scratching a lot...",
                "isVendorResponse": false,
                "authorProfileId": "user-uuid",
                "authorName": "Jane Doe",
                "authorPhotoURL": null,
                "createdAt": "2026-09-04T12:00:00.000Z"
            },
            {
                "id": "...",
                "message": "I'd recommend checking for fleas first...",
                "isVendorResponse": true,
                "authorProfileId": "vet-uuid",
                "authorName": "Dr. Smith",
                "authorPhotoURL": "https://...",
                "createdAt": "2026-09-04T12:00:05.000Z"
            }
        ]
    }
}
```

Key message fields:
- `isVendorResponse` — `true` for AI/vet responses, `false` for user messages
- `authorName` — sender's display name
- `authorPhotoURL` — sender's profile photo URL (vet photo during live chat, `null` for AI bot)

## Environment variables

| Variable                | Required | Description                                    |
| ----------------------- | -------- | ---------------------------------------------- |
| `ASKVERA_BASE_URL`      | ✓        | Base URL of the AskVERA API                    |
| `ASKVERA_CLIENT_ID`     | ✓        | OAuth client ID (UUID)                         |
| `ASKVERA_CLIENT_SECRET` | ✓        | OAuth client secret                            |
| `PORT`                  |          | Server port (default: `3001`)                  |
| `ALLOWED_ORIGIN`        |          | CORS origin (default: `http://localhost:5173`) |

## Requirements

- **Node.js ≥ 18** (uses the built-in `fetch` API)
- **npm** (bundled with Node) or **yarn**

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

Connect to `ws://localhost:3001/ws?sessionId=<id>`. The server polls AskVERA and pushes events whenever new messages arrive:

```json
{
    "type": "session.update",
    "session": {
        "id": "...",
        "messages": [{"id": "...", "message": "...", "isVendorResponse": true, "createdAt": "..."}]
    }
}
```

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

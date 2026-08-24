# AskVERA Integration Examples

Two runnable examples showing how to connect to the AskVERA API using OAuth 2.0 Client Credentials.

```
examples/askVERA/
├── server/      Node.js/Express backend — holds credentials, proxies AskVERA calls
└── webClient/   React chat UI — talks only to the server, never directly to AskVERA
```

## Why a backend server?

The AskVERA API uses OAuth 2.0 Client Credentials (`client_id` + `client_secret`) to authenticate. These credentials **must never be exposed to a browser**. If you embed them in a frontend bundle, any user can open DevTools, extract the secret, and make API calls on your behalf.

The example server exists to keep credentials safe:

```
Browser (React)  ──WS──→  Example Server (Express)  ──WS────→  AskVERA API
                 ──HTTP──→         │                 ──REST──→  (api-dev.askvera.ai)
                           Holds client_id + client_secret
                           Manages Bearer token lifecycle
```

**The server is the only component that knows your credentials.** The React client never sees them. The browser talks to the example server; the server authenticates with AskVERA on the browser's behalf.

**Postman, Swagger, curl, and direct API calls are fine for development** — your credentials stay on your machine and are never sent to a browser. The backend proxy pattern is only necessary when building a web or mobile frontend.

> **Common mistake:** The web client's `VITE_SERVER_URL` must point to the **example server** (`http://localhost:3001`), NOT to the AskVERA API (`https://api-dev.askvera.ai`). The example server is the middleman — it holds your credentials and proxies all API calls. The browser never talks to the AskVERA API directly.

---

## Security notice

> **This example server has no authentication between the browser and the server.** Any caller at the allowed CORS origin can make requests without a token. This is intentional for a local demo but is **not production-ready**. See [Production considerations](#production-considerations) below.

---

## Real-time delivery

The browser connects to the **example server** over WebSocket (`ws://localhost:3001/ws?sessionId=<id>`). The example server maintains a single authenticated WebSocket connection upstream to AskVERA's `/ws/askvera` endpoint, which delivers real-time events (`session.started`, `session.message`, `session.ended`, `session.escalated`). When an event arrives, the server fetches the full session and pushes it to watching browser clients. If the upstream WebSocket is unavailable, the server falls back to per-client REST polling automatically.

---

## Prerequisites

- **Node.js >= 18** (uses the built-in `fetch` API)
- **npm** (bundled with Node) or **yarn** — both work. The examples below show both; pick one and use it consistently.

---

## Quick start

### 1 — Get OAuth credentials

Call `POST /api/askvera/v1/oauth/clients` with your existing `x-api-key` to create a client:

```sh
curl -X POST https://your-api.example.com/api/askvera/v1/oauth/clients \
  -H "Content-Type: application/json" \
  -H "x-account-id: <your-account-id>" \
  -H "x-api-key: <your-api-key>" \
  -d '{ "description": "Web chat example" }'
```

Save the `clientId` and `clientSecret` from the response — **the secret is shown only once**.

### 2 — Start the server

```sh
cd server
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
# The AskVERA API you want to connect to
ASKVERA_BASE_URL=https://api-dev.askvera.ai

# OAuth credentials from step 1
ASKVERA_CLIENT_ID=your-client-id
ASKVERA_CLIENT_SECRET=your-client-secret
```

> **Important:** `ASKVERA_BASE_URL` goes in the **server** `.env` only. The web client should NOT have this URL — it talks to the example server, not the API.

**Using npm:**

```sh
npm install
npm run dev
```

**Using yarn:**

```sh
yarn install
yarn dev
```

### 3 — Start the web client

```sh
cd webClient
```

**Using npm:**

```sh
npm install
npm run dev
```

**Using yarn:**

```sh
yarn install
yarn dev
```

Then open **http://localhost:5173**.

> **First launch note:** Vite compiles dependencies on the first run, which can take **up to a minute** before the dev server is ready. This is normal — subsequent starts are nearly instant. Don't kill the process early.

---

## Running tests

The project includes Playwright end-to-end tests that exercise the full chat flow through the browser.

### Prerequisites

- **Both servers must be running** (server on port 3001, web client on port 5173)
- Playwright browsers must be installed (one-time setup)

### Setup

```sh
# Install Playwright browsers (one-time)
cd webClient
npx playwright install chromium
```

### Run tests

```sh
# From the askVERA root (uses Makefile)
make test

# Or from the webClient directory
cd webClient
npm test               # yarn: yarn test

# Run with visible browser (useful for debugging)
make test-headed
# or
cd webClient
npm run test:headed    # yarn: yarn test:headed
```

### What the tests cover

| Test                            | Description                                                               |
| ------------------------------- | ------------------------------------------------------------------------- |
| Setup form loads                | All form fields (name, email, pet, question) are present                  |
| Species dropdown                | Verifies Dog, Cat, and other species options exist                        |
| Submit loading state            | Button disables and shows spinner during submission                       |
| Full chat flow                  | Fill form → start session → see chat → send message → end chat → new chat |
| Live vet button                 | "Request Live Vet" CTA is visible in AI sessions                          |
| New chat navigation             | "+ New Chat" returns to the setup form                                    |
| Form validation                 | Empty form cannot be submitted (HTML5 required)                           |
| WS connects and receives events | Example server WebSocket delivers `session.update` events                 |
| WS rejects without sessionId    | Server closes connection with code 4000 if sessionId missing              |
| Browser uses WS not polling     | Verifies the chat window opens a WebSocket connection                     |

---

## Chat flow

1. User fills out their first name, last name, email, pet details, and an opening question
2. Server creates the user + pet + session via the AskVERA API
3. Chat window appears — opening question shown, typing indicator while vet bot responds
4. Client connects to the server WebSocket; server pushes `session.update` events as new messages arrive (falls back to REST polling if WS unavailable)
5. User can send follow-up messages
6. User can attach images via the paperclip button (see **Image uploads** below)
7. User can request a **live vet** — session escalates from AI to a real veterinarian
8. **End Chat** closes the session; **+ New Chat** starts a fresh one

---

## Image uploads

Images follow a two-step flow:

1. **Upload** — The client sends the image to the example server (`POST /api/sessions/:id/images`), which proxies it to the AskVERA `ChatPostFile/Upload` endpoint. AskVERA returns a hosted `url` and `thumbUrl`.
2. **Send** — The client sends a follow-up message (`POST /api/sessions/:id/messages`) with the returned `imageUrl`. The server passes the file reference in the `PostAdded` request to AskVERA so the image appears in the operator portal.

Images sent **by the vet** arrive via the webhook response and are stored as `outputURL` on the message. The chat UI renders them inline above the message bubble.

**Note:** This example converts the selected file to a data URL (`data:image/...;base64,...`) and sends it through JSON. The server-side `uploadChatPostFile` decodes the data URL, then uploads the binary to AskVet's `ChatPostFile/Upload` as multipart/form-data. This works for a self-contained demo but is inefficient for large files. In production, upload images to your own storage (S3, CDN, etc.) first and pass the hosted URL instead.

### Server routes

| Method | Path                         | Description                              |
| ------ | ---------------------------- | ---------------------------------------- |
| `POST` | `/api/sessions/:id/images`   | Upload an image (body: `{ imageUrl }`)   |
| `POST` | `/api/sessions/:id/messages` | Send message, optionally with `imageUrl` |

### Client API (`api.js`)

```js
// Upload an image, returns { url, thumbUrl }
uploadImage(sessionId, dataUrl)

// Send a message with optional image attachment
sendMessage(sessionId, userId, message, imageUrl)
```

---

## Production considerations

This example is designed for local development and learning. Before deploying to production, address the following:

| Area                      | Issue                                                                                                                | Recommendation                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Client-to-server auth** | The Express server accepts requests from any caller — there is no authentication between the browser and the server. | Add your own auth layer (session cookies, JWTs, API keys) so only your authenticated users can proxy requests through the server.   |
| **CORS origin**           | `ALLOWED_ORIGIN` defaults to `http://localhost:5173` and accepts any origin if not set.                              | Restrict to your actual production domain (e.g., `https://app.yourcompany.com`). Never use `*` in production.                       |
| **Public exposure**       | The server binds to all interfaces and has no rate limiting or IP restrictions.                                      | Place behind a reverse proxy (nginx, Cloudflare, AWS ALB), add rate limiting, and restrict access to known clients.                 |
| **Credential storage**    | Credentials live in a `.env` file on disk.                                                                           | Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) and inject credentials via environment variables at deploy time. |
| **Token caching**         | The OAuth token is cached in memory. A server restart requires a new token exchange.                                 | For multi-instance deployments, consider caching tokens in Redis or a shared store so all instances share the same token.           |
| **Error handling**        | Errors are returned as generic JSON `{ error: "..." }`.                                                              | Add structured error codes, request IDs, and monitoring (Sentry, Datadog) for production debugging.                                 |

---

## Troubleshooting

### "WebSocket connection failed — falling back to REST polling"

This console warning means the web client could not connect to the example server's WebSocket. Common causes:

| Cause                                            | Fix                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **Example server not running**                   | Start it: `cd server && npm run dev`                                                                   |
| **`VITE_SERVER_URL` pointed at the AskVERA API** | Change it back to `http://localhost:3001`. The web client connects to the example server, not the API. |
| **Port mismatch**                                | Make sure the server is on port 3001 (or whatever `VITE_SERVER_URL` points to)                         |

The app will still work via REST polling, but message delivery will be slower (2.5s intervals instead of instant).

### "Token request failed (400): unsupported_grant_type" or "invalid_client"

Your OAuth credentials in `server/.env` are wrong or expired. Double-check `ASKVERA_CLIENT_ID` and `ASKVERA_CLIENT_SECRET`. If you're switching from localhost to a remote API, you need credentials created on that server — localhost credentials won't work on `api-dev.askvera.ai` and vice versa.

### Web client shows a blank page or takes forever to load

On the first run, Vite compiles all dependencies which can take up to a minute. Wait for the terminal to show `ready in XXXms` before opening the browser. Subsequent starts are instant.

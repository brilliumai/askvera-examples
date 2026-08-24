# AskVERA Web Client Example

A React chat interface demonstrating a complete AskVERA integration — pet owner onboarding, session creation, real-time message delivery via WebSocket, and follow-up messaging.

## Setup

```sh
cp .env.example .env   # optional — only needed if the server runs on a non-default port
```

**Using npm:**

```sh
npm install
npm run dev            # open http://localhost:5173
```

**Using yarn:**

```sh
yarn install
yarn dev               # open http://localhost:5173
```

> The example server (`../server`) must be running first.

> **First launch note:** Vite compiles dependencies on the first run, which can take **up to a minute** before the page is ready. This is normal — subsequent starts are nearly instant. Don't kill the process early.

## Requirements

- **Node.js ≥ 18**
- **npm** (bundled with Node) or **yarn**

## User flow

| Step        | What happens                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Setup form  | User enters first name, last name, email, postal code, pet name, species, and opening question |
| Submit      | Server creates a user + pet + session; returns IDs                                             |
| Chat window | Opening question appears immediately; typing indicator shows while waiting                     |
| WebSocket   | Client connects to `ws://server/ws?sessionId=<id>`; server pushes new messages live            |
| Follow-up   | User types in the input bar and sends additional questions                                     |
| New Chat    | Clears state and returns to the setup form                                                     |

## File overview

```
src/
├── App.jsx                  State machine (setup → chat)
├── api.js                   Fetch helpers for the server's three endpoints
├── index.css                All styles — no CSS framework needed
└── components/
    ├── SetupForm.jsx        Onboarding form
    ├── ChatWindow.jsx       Live chat (WebSocket primary, polling fallback) + send
    └── MessageBubble.jsx    Single message (user or vet)
```

## Environment variables

| Variable          | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `VITE_SERVER_URL` | URL of the example server (default: `http://localhost:3001`) |

> **Do NOT set `VITE_SERVER_URL` to the AskVERA API URL** (e.g., `https://api-dev.askvera.ai`). This variable must point to the example server running locally. The example server is the middleman that holds your OAuth credentials and proxies requests to the AskVERA API. If you point the web client directly at the API, REST calls will fail (no auth) and WebSocket connections will fail (wrong endpoint), causing the app to fall back to broken polling.

## Tests

Playwright end-to-end tests verify the full chat flow through the browser.

```sh
# One-time setup: install Chromium
npx playwright install chromium

# Run tests (both servers must be running)
npm test               # yarn: yarn test

# Run with visible browser
npm run test:headed    # yarn: yarn test:headed
```

See the [parent README](../README.md#running-tests) for more details.

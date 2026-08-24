# AskVERA Integration Examples

Ready-to-run examples showing how to integrate with the [AskVERA](https://askvera.ai) veterinary AI chat API.

## Examples

### [askVERA](./askVERA/) — Full Chat Integration

A complete React + Node.js demo app demonstrating OAuth 2.0 authentication, session management, real-time messaging via WebSocket, image uploads, live vet escalation, and NPS ratings.

```
askVERA/
├── server/      Node.js/Express backend — holds credentials, proxies AskVERA calls
└── webClient/   React chat UI — talks only to the server, never directly to AskVERA
```

**Quick start:**

```bash
cd askVERA/server
cp .env.example .env        # fill in your OAuth credentials
npm install && npm run dev

# In a second terminal:
cd askVERA/webClient
cp .env.example .env        # optional — defaults are fine for local dev
npm install && npm run dev
# Open http://localhost:5173
```

See the [askVERA README](./askVERA/README.md) for full setup instructions, architecture details, and test coverage.

### [partner-integration](./partner-integration/) — Server-to-Server Login Flow

A minimal Node.js server demonstrating the partner login token flow — authenticate your server, request a login URL for your user, and redirect them directly into AskVERA chat with no sign-up required.

**Quick start:**

```bash
cd partner-integration
cp .env.example .env        # fill in your OAuth credentials
npm install && npm start
# Open http://localhost:3100
```

See the [partner-integration README](./partner-integration/README.md) for the full API reference.

## Prerequisites

- **Node.js >= 18** (uses the built-in `fetch` API)
- **OAuth credentials** — create these via `POST /api/askvera/v1/oauth/clients` with your API key, or contact your AskVera representative

## Security

These examples are designed for **local development and learning**. Before deploying to production:

- Never expose `client_secret` in frontend/client-side code
- Add authentication between your browser and your backend server
- Restrict CORS origins to your production domain
- Use a secrets manager for credential storage

See the [askVERA README — Production considerations](./askVERA/README.md#production-considerations) for a full checklist.

## Releases

Each release publishes a versioned zip to S3:

- **Latest:** `s3://askvet-public-assets/examples/askvera-example.zip`
- **Versioned:** `s3://askvet-public-assets/examples/askvera-example-v{version}.zip`

Partners can pin to a specific version to avoid breaking changes during integration.

## License

Proprietary. For use by authorized AskVERA integration partners only.

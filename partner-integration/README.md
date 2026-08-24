# AskVERA Partner Integration

This example demonstrates how to integrate AskVERA's 24/7 AI Vet Chat into your platform using a server-to-server token exchange. Your users get dropped directly into the chat experience with no sign-up, OTP, or payment screens.

## Prerequisites

- Node.js 18+ (uses built-in `fetch`)
- Your OAuth credentials (provided by AskVera):
    - `ASKVERA_CLIENT_ID`
    - `ASKVERA_CLIENT_SECRET`

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and add your credentials
cp .env.example .env
# Edit .env with the credentials provided by AskVera

# 3. Start the demo server
npm start
```

Open http://localhost:3100 in your browser, fill in a test user, and click **"Open 24/7 Vet Chat"**.

## How It Works

The integration is a simple 3-step server-to-server flow:

### Step 1 — Authenticate your server

Your backend authenticates with the AskVERA API using OAuth `client_credentials`:

```
POST https://api.askvera.ai/api/askvera/v1/oauth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET"
}
```

Response:

```json
{
    "access_token": "eyJhbG...",
    "token_type": "Bearer",
    "expires_in": 3600
}
```

Cache this token and reuse it until it expires (1 hour). Do **not** request a new token on every user click.

### Step 2 — Request a login URL for your user

When a user clicks your "Vet Chat" button, your backend calls the partner login endpoint with the user's details:

```
POST https://api.askvera.ai/api/askvera/v1/partner/login-token
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "user": {
    "email": "jane@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "postalCode": "90210",
    "externalId": "USR-12345"
  },
  "pets": [
    {
      "petName": "Buddy",
      "species": "dog",
      "breed": "Golden Retriever",
      "birthDate": "2021-03-15",
      "gender": "male",
      "weight": "65",
      "isSpayedOrNeutered": true,
      "clientPetId": "PET-001"
    }
  ],
  "returnUrl": "https://yoursite.com/dashboard"
}
```

Response:

```json
{
    "loginUrl": "https://app.askvera.ai/partner-login?token=...&refresh=...&profileId=...&brandSlug=...",
    "profileId": "uuid",
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token"
}
```

### Step 3 — Redirect the user's browser

Redirect the user to `loginUrl`. They land directly in the branded AskVERA chat — no sign-up or payment required.

If you provided a `returnUrl`, the user will see a "Back to [Your Brand]" button in the chat app header.

## API Field Reference

### User (required object)

| Field        | Required | Description                                                                                           |
| ------------ | -------- | ----------------------------------------------------------------------------------------------------- |
| `email`      | Yes      | User's email address (used for account matching)                                                      |
| `firstName`  | Yes      | First name                                                                                            |
| `lastName`   | Yes      | Last name                                                                                             |
| `postalCode` | No       | Postal/ZIP code                                                                                       |
| `externalId` | No       | Your internal user ID. Recommended — provides reliable matching even if the user changes their email. |

### Pets (optional array)

| Field                | Required | Description                                                                       |
| -------------------- | -------- | --------------------------------------------------------------------------------- |
| `petName`            | Yes      | Pet's name                                                                        |
| `species`            | Yes      | `"dog"`, `"cat"`, `"bird"`, `"reptile"`, `"horse"`, `"small_animal"`, etc.        |
| `breed`              | Yes      | Breed name (e.g. `"Golden Retriever"`, `"Domestic Shorthair"`)                    |
| `birthDate`          | Yes      | Date of birth in `YYYY-MM-DD` format                                              |
| `gender`             | No       | `"male"` or `"female"`                                                            |
| `weight`             | No       | Weight as a string (e.g. `"65"`)                                                  |
| `isSpayedOrNeutered` | No       | `true` or `false`                                                                 |
| `clientPetId`        | No       | Your internal pet ID. Recommended — allows reliable pet matching across sessions. |

### Return URL (optional string)

| Field       | Required | Description                                                                       |
| ----------- | -------- | --------------------------------------------------------------------------------- |
| `returnUrl` | No       | URL to navigate back to your portal. Shown as a "Back" button in the chat header. |

## Security Notes

- **Never expose your `client_secret` in frontend/client-side code.** The OAuth flow must happen server-to-server.
- The `access_token` from Step 1 is a short-lived server token (1 hour). Cache it and reuse it.
- The `loginUrl` returned in Step 2 contains short-lived user tokens. Generate a fresh one each time a user clicks into the chat.

## Production Integration

In production, you won't need the demo form — your backend already has the user and pet data. The integration is just two API calls:

```javascript
// 1. Get OAuth token (cache this)
const token = await getAccessToken()

// 2. Get login URL for this user
const {loginUrl} = await getPartnerLoginUrl(user, pets, returnUrl)

// 3. Redirect
res.redirect(loginUrl)
```

See `server.js` for a complete working implementation.

## Support

Contact your AskVera integration representative for help with setup or testing.

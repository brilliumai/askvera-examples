// AskVERA Partner Integration - Example Server
// This demonstrates the server-to-server flow:
//   1. Partner backend authenticates with AskVERA via OAuth client_credentials
//   2. Partner backend calls POST /api/askvera/v1/partner/login-token with user + pet data
//   3. AskVERA returns a loginUrl
//   4. Partner redirects the user's browser to that loginUrl

require('dotenv').config()
const express = require('express')
const path = require('path')

const app = express()
app.use(express.json())
app.use(express.urlencoded({extended: true}))

const {ASKVERA_CLIENT_ID, ASKVERA_CLIENT_SECRET, ASKVERA_API_URL, PORT = 3100} = process.env

if (!ASKVERA_CLIENT_ID || !ASKVERA_CLIENT_SECRET || !ASKVERA_API_URL) {
    console.error('Missing required environment variables. Copy .env.example to .env and fill in your credentials.')
    process.exit(1)
}

// In-memory token cache (in production, use Redis or similar)
let cachedToken = null
let tokenExpiresAt = 0

// --- Step 1: Get an OAuth access token ---
async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
        return cachedToken
    }

    const res = await fetch(`${ASKVERA_API_URL}/api/askvera/v1/oauth/token`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: ASKVERA_CLIENT_ID,
            client_secret: ASKVERA_CLIENT_SECRET,
        }),
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`OAuth token request failed (${res.status}): ${text}`)
    }

    const data = await res.json()
    cachedToken = data.access_token
    tokenExpiresAt = Date.now() + data.expires_in * 1000
    console.log('OAuth token acquired, expires in', data.expires_in, 'seconds')
    return cachedToken
}

// --- Step 2: Call partner/login-token ---
async function getPartnerLoginUrl(user, pets, returnUrl) {
    const token = await getAccessToken()

    const body = {user, pets}
    if (returnUrl) body.returnUrl = returnUrl

    const res = await fetch(`${ASKVERA_API_URL}/api/askvera/v1/partner/login-token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`partner/login-token failed (${res.status}): ${text}`)
    }

    return res.json()
}

// --- Routes ---

// Serve the demo portal page
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'))
})

// Simulate "24/7 Vet Chat" button click
// In production, user + pet data comes from your database
app.post('/launch-vet-chat', async (req, res) => {
    try {
        const {email, firstName, lastName, postalCode, externalId, petName, species, breed, birthDate} = req.body

        const user = {
            email,
            firstName,
            lastName,
            ...(postalCode && {postalCode}),
            ...(externalId && {externalId}),
        }

        const pets = petName
            ? [
                  {
                      petName,
                      species: species || 'dog',
                      breed: breed || 'Mixed',
                      birthDate: birthDate || '2020-01-01',
                  },
              ]
            : []

        // Optional: include a return URL so users can navigate back to your portal
        const returnUrl = `${req.protocol}://${req.get('host')}/`

        console.log('Requesting login token for:', {user, pets, returnUrl})

        const result = await getPartnerLoginUrl(user, pets, returnUrl)
        console.log('Got login URL:', result.loginUrl)

        // Step 3: Redirect the user's browser to the AskVERA chat app
        res.redirect(result.loginUrl)
    } catch (err) {
        console.error('Error:', err.message)
        res.status(500).send(`
            <h2>Error</h2>
            <pre>${err.message}</pre>
            <a href="/">Back</a>
        `)
    }
})

app.listen(PORT, () => {
    console.log(`Partner integration example running at http://localhost:${PORT}`)
    console.log(`Using AskVERA API: ${ASKVERA_API_URL}`)
})

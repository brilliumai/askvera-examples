import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import {createServer} from 'http'
import {WebSocketServer, WebSocket} from 'ws'
import {AskVERAClient} from './askveraClient.js'
import {createRoutes} from './routes.js'

dotenv.config()

// ── Validate required env vars ──────────────────────────────────────────────
const REQUIRED = ['ASKVERA_BASE_URL', 'ASKVERA_CLIENT_ID', 'ASKVERA_CLIENT_SECRET']
for (const key of REQUIRED) {
    if (!process.env[key]) {
        console.error(`\n  Missing required environment variable: ${key}`)
        console.error('  Copy .env.example to .env and fill in your credentials.\n')
        process.exit(1)
    }
}

// ── AskVERA API client (manages Bearer token lifecycle) ──────────────────────
const askVera = new AskVERAClient({
    baseUrl: process.env.ASKVERA_BASE_URL,
    clientId: process.env.ASKVERA_CLIENT_ID,
    clientSecret: process.env.ASKVERA_CLIENT_SECRET,
})

// ── Express app ──────────────────────────────────────────────────────────────
const app = express()

app.use(
    cors({
        origin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }),
)
app.use(express.json())

app.use('/api', createRoutes(askVera))

app.get('/health', (_req, res) => res.json({ok: true}))

// ── Upstream WS connection to AskVERA /ws/askvera ────────────────────────────
//
// A single authenticated WebSocket connection receives real-time events for the
// account (session.started, session.message, session.ended, session.escalated).
// Each event includes a `data` object with event-specific fields — for
// session.message events, `data` includes message, isVendorResponse, authorName,
// authorPhotoURL, and sessionName.
// When an event arrives, the server fetches the full session via REST and pushes
// it to every browser client watching that sessionId.
//
// If the upstream WS is unavailable, browser clients fall back to per-client
// REST polling automatically.

const WS_BASE = process.env.ASKVERA_BASE_URL.replace(/^http/, 'ws')
const UPSTREAM_RECONNECT_MS = 5_000
const POLL_FALLBACK_MS = 2500

// sessionId → Set<WebSocket>  — tracks which browser clients want which session
const sessionWatchers = new Map()

let upstreamWs = null
let upstreamConnected = false

async function connectUpstream() {
    try {
        const token = await askVera.getToken()
        const url = `${WS_BASE}/ws/askvera?token=${encodeURIComponent(token)}`

        upstreamWs = new WebSocket(url)

        upstreamWs.on('open', () => {
            upstreamConnected = true
            console.log('[upstream] Connected to AskVERA WebSocket')
        })

        upstreamWs.on('message', async (raw) => {
            try {
                const event = JSON.parse(raw.toString())
                const sessionId = event.sessionId
                if (!sessionId) return

                const watchers = sessionWatchers.get(sessionId)
                if (!watchers || watchers.size === 0) return

                // Fetch the full session so the browser gets the complete messages array
                const data = await askVera.fetch(`/api/askvera/v1/sessions/${sessionId}`)
                const payload = JSON.stringify({type: 'session.update', session: data})

                for (const client of watchers) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(payload)
                    }
                }
            } catch (err) {
                console.error('[upstream] Error handling event:', err.message)
            }
        })

        upstreamWs.on('close', (code, reason) => {
            upstreamConnected = false
            console.warn(
                `[upstream] Disconnected (${code}: ${reason || 'no reason'}) — reconnecting in ${UPSTREAM_RECONNECT_MS / 1000}s`,
            )
            setTimeout(connectUpstream, UPSTREAM_RECONNECT_MS)
        })

        upstreamWs.on('error', (err) => {
            console.error('[upstream] WebSocket error:', err.message)
            // 'close' event will fire after this, triggering reconnect
        })
    } catch (err) {
        console.error('[upstream] Failed to connect:', err.message, `— retrying in ${UPSTREAM_RECONNECT_MS / 1000}s`)
        setTimeout(connectUpstream, UPSTREAM_RECONNECT_MS)
    }
}

// Start the upstream connection
connectUpstream()

// ── Browser-facing WebSocket server ──────────────────────────────────────────
//
// Browser clients connect here: ws://localhost:3001/ws?sessionId=<id>
// Events pushed: { type: "session.update", session: { id, messages, ... } }
//
// When the upstream WS is connected, events arrive in real-time.
// When it's not, each browser client falls back to REST polling.
const httpServer = createServer(app)
const wss = new WebSocketServer({server: httpServer, path: '/ws'})

wss.on('connection', (ws, req) => {
    const {searchParams} = new URL(req.url, 'http://x')
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
        ws.close(4000, 'sessionId query param required')
        return
    }

    if (!sessionWatchers.has(sessionId)) sessionWatchers.set(sessionId, new Set())
    sessionWatchers.get(sessionId).add(ws)

    // Always do an initial fetch so the browser gets current state immediately
    const pushInitial = async () => {
        if (ws.readyState !== WebSocket.OPEN) return
        try {
            const data = await askVera.fetch(`/api/askvera/v1/sessions/${sessionId}`)
            ws.send(JSON.stringify({type: 'session.update', session: data}))
        } catch {
            // Session not ready yet — will get updates via upstream WS or polling
        }
    }
    pushInitial()

    // Fallback polling — only active when upstream WS is disconnected
    const knownIds = new Set()
    const pollFallback = async () => {
        if (ws.readyState !== WebSocket.OPEN) return
        if (upstreamConnected) return // upstream WS is delivering events
        try {
            const data = await askVera.fetch(`/api/askvera/v1/sessions/${sessionId}`)
            const fresh = data.messages.filter((m) => !knownIds.has(m.id))
            if (fresh.length) {
                fresh.forEach((m) => knownIds.add(m.id))
                ws.send(JSON.stringify({type: 'session.update', session: data}))
            }
        } catch {
            // Session not ready yet or token expired — keep retrying
        }
    }
    const interval = setInterval(pollFallback, POLL_FALLBACK_MS)

    ws.on('close', () => {
        clearInterval(interval)
        const set = sessionWatchers.get(sessionId)
        if (set) {
            set.delete(ws)
            if (set.size === 0) sessionWatchers.delete(sessionId)
        }
    })
})

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001
httpServer.listen(PORT, () => {
    console.log(`\n  AskVERA example server`)
    console.log(`    HTTP      : http://localhost:${PORT}`)
    console.log(`    WebSocket : ws://localhost:${PORT}/ws?sessionId=<id>`)
    console.log(`    API target: ${process.env.ASKVERA_BASE_URL}`)
    console.log(`    Upstream WS: ${WS_BASE}/ws/askvera`)
    console.log(`    CORS allow: ${process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'}\n`)
})

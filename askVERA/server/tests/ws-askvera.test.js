/**
 * Direct WebSocket test for george-api's /ws/askvera endpoint.
 *
 * This tests the real WS endpoint (not the example server's polling WS).
 * It verifies that:
 *   1. OAuth token auth works for WS connections
 *   2. Connections without a token are rejected
 *   3. Connections with an invalid token are rejected
 *
 * Prerequisites:
 *   - george-api running locally (default: localhost:4010)
 *   - Example server .env has valid ASKVERA_CLIENT_ID / ASKVERA_CLIENT_SECRET
 *
 * Run:
 *   node tests/ws-askvera.test.js
 */

import WebSocket from 'ws'
import dotenv from 'dotenv'

dotenv.config()

const BASE_URL = process.env.ASKVERA_BASE_URL || 'http://localhost:4010'
const WS_URL = BASE_URL.replace(/^http/, 'ws')

let passed = 0
let failed = 0

function assert(condition, message) {
    if (condition) {
        console.log(`  PASS: ${message}`)
        passed++
    } else {
        console.error(`  FAIL: ${message}`)
        failed++
    }
}

async function getOAuthToken() {
    const res = await fetch(`${BASE_URL}/api/askvera/v1/oauth/token`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: process.env.ASKVERA_CLIENT_ID,
            client_secret: process.env.ASKVERA_CLIENT_SECRET,
        }),
    })
    if (!res.ok) throw new Error(`Token request failed: ${res.status}`)
    const {access_token} = await res.json()
    return access_token
}

function connectWs(url, options = {}) {
    return new Promise((resolve) => {
        const ws = new WebSocket(url, options)
        const result = {opened: false, closed: false, code: null, reason: null, error: null}
        const timeout = setTimeout(() => {
            ws.close()
            result.closed = true
            result.code = 'timeout'
            resolve(result)
        }, 10000)

        ws.on('open', () => {
            result.opened = true
            clearTimeout(timeout)
            // Keep open briefly then close
            setTimeout(() => {
                ws.close()
            }, 500)
        })

        ws.on('close', (code, reason) => {
            clearTimeout(timeout)
            result.closed = true
            result.code = code
            result.reason = reason?.toString() || ''
            resolve(result)
        })

        ws.on('error', (err) => {
            result.error = err.message
        })
    })
}

async function main() {
    console.log(`\nTesting george-api WebSocket at ${WS_URL}/ws/askvera\n`)

    // Test 1: Connection without token should be rejected
    console.log('Test 1: Reject connection without token')
    const noToken = await connectWs(`${WS_URL}/ws/askvera`)
    assert(noToken.closed, 'Connection was closed')
    assert(noToken.code === 4401, `Close code is 4401 (got ${noToken.code})`)
    assert(
        noToken.reason.includes('missing token') || noToken.reason.includes('Unauthorized'),
        `Reason mentions auth (got "${noToken.reason}")`,
    )

    // Test 2: Connection with invalid token should be rejected
    console.log('\nTest 2: Reject connection with invalid token')
    const badToken = await connectWs(`${WS_URL}/ws/askvera?token=invalid-token-abc123`)
    assert(badToken.closed, 'Connection was closed')
    assert(badToken.code === 4401, `Close code is 4401 (got ${badToken.code})`)

    // Test 3: Connection with valid OAuth token should succeed
    console.log('\nTest 3: Accept connection with valid OAuth token')
    let token
    try {
        token = await getOAuthToken()
        assert(!!token, 'OAuth token obtained')
    } catch (e) {
        console.error(`  SKIP: Could not get OAuth token — ${e.message}`)
        console.log('\n' + '='.repeat(50))
        console.log(`Results: ${passed} passed, ${failed} failed`)
        process.exit(failed > 0 ? 1 : 0)
    }

    const withToken = await connectWs(`${WS_URL}/ws/askvera?token=${token}`)
    assert(withToken.opened, 'Connection opened successfully')
    assert(withToken.code === 1000 || withToken.code === 1005, `Clean close (got code ${withToken.code})`)

    // Test 4: Connection with valid token via Authorization header
    console.log('\nTest 4: Accept connection with Authorization header')
    const withHeader = await connectWs(`${WS_URL}/ws/askvera`, {
        headers: {Authorization: `Bearer ${token}`},
    })
    assert(withHeader.opened, 'Connection opened successfully')
    assert(withHeader.code === 1000 || withHeader.code === 1005, `Clean close (got code ${withHeader.code})`)

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log(`Results: ${passed} passed, ${failed} failed`)
    process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
    console.error('Test runner error:', err)
    process.exit(1)
})

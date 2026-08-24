/**
 * AskVERAClient
 *
 * Wraps the AskVERA API with automatic OAuth 2.0 Client Credentials token management.
 * Tokens are cached in memory and refreshed 60 seconds before they expire (1-hour lifetime).
 *
 * Usage:
 *   const client = new AskVERAClient({ baseUrl, clientId, clientSecret })
 *   const users  = await client.fetch('/api/askvera/v1/users')
 */
export class AskVERAClient {
    /** @param {{ baseUrl: string, clientId: string, clientSecret: string }} opts */
    constructor({baseUrl, clientId, clientSecret}) {
        this.baseUrl = baseUrl
        this.clientId = clientId
        this.clientSecret = clientSecret

        /** @private */
        this._token = null
        /** @private Unix ms */
        this._expiresAt = 0
    }

    /**
     * Returns a valid Bearer token, fetching a new one if needed.
     * @returns {Promise<string>}
     */
    async getToken() {
        // Reuse cached token if it still has > 60s left
        if (this._token && Date.now() < this._expiresAt - 60_000) {
            return this._token
        }

        const res = await fetch(`${this.baseUrl}/api/askvera/v1/oauth/token`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret,
            }),
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(`Token request failed (${res.status}): ${err.error ?? 'unknown'}`)
        }

        const {access_token, expires_in} = await res.json()
        this._token = access_token
        this._expiresAt = Date.now() + expires_in * 1_000
        return this._token
    }

    /**
     * Make an authenticated request to the AskVERA API.
     *
     * @param {string} path   e.g. '/api/askvera/v1/users'
     * @param {RequestInit} [options]
     * @returns {Promise<any>}
     */
    async fetch(path, options = {}) {
        const token = await this.getToken()
        const method = options.method ?? 'GET'
        const url = `${this.baseUrl}${path}`

        const res = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                ...options.headers,
            },
        })

        const body = await res.json().catch(() => ({}))

        if (!res.ok) {
            console.error('[AskVERA]   error body:', JSON.stringify(body, null, 2))
            const err = new Error(body.error ?? body.message ?? `AskVERA API error (${res.status})`)
            err.status = res.status
            err.body = body
            throw err
        }

        return body
    }
}

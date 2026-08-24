import {Router} from 'express'

/**
 * Creates the /api routes that proxy AskVERA endpoints.
 * The React client talks only to these routes — it never calls AskVERA directly.
 *
 * @param {import('./askveraClient.js').AskVERAClient} client
 */
export function createRoutes(client) {
    const r = Router()

    /**
     * POST /api/sessions/start
     *
     * Creates a user, a pet, and a chat session in a single call.
     * This is the "new conversation" entry point for the web client.
     *
     * Body:    { firstName, lastName, email, postalCode?, petName, species, breed?, birthDate, question }
     * Returns: { sessionId, userId, petId }
     */
    r.post('/sessions/start', async (req, res) => {
        const {firstName, lastName, email, postalCode, petName, species, breed, birthDate, question} = req.body

        if (!firstName || !lastName || !email || !petName || !species || !birthDate || !question) {
            return res.status(400).json({
                error: 'firstName, lastName, email, petName, species, birthDate, and question are required',
            })
        }

        try {
            // 1. Create the pet owner profile
            const user = await client.fetch('/api/askvera/v1/users', {
                method: 'POST',
                body: JSON.stringify({firstName, lastName, email, ...(postalCode && {postalCode})}),
            })

            // 2. Create the pet
            const pet = await client.fetch(`/api/askvera/v1/users/${user.id}/pets`, {
                method: 'POST',
                body: JSON.stringify({
                    petName,
                    species,
                    breed: breed || 'Mixed',
                    birthDate,
                }),
            })

            // 3. Open a chat session — the opening question is delivered to the vet bot
            const session = await client.fetch('/api/askvera/v1/sessions', {
                method: 'POST',
                body: JSON.stringify({
                    userId: user.id,
                    petId: pet.id,
                    question,
                    sessionName: `${firstName} ${lastName}'s question about ${petName}`,
                }),
            })

            res.json({sessionId: session.id, userId: user.id, petId: pet.id})
        } catch (err) {
            console.error('[POST /api/sessions/start] FAILED:', err.message)
            if (err.body)
                console.error('[POST /api/sessions/start] upstream error body:', JSON.stringify(err.body, null, 2))
            res.status(err.status ?? 500).json({error: err.message})
        }
    })

    /**
     * GET /api/sessions/:sessionId
     *
     * Returns the full session with all messages.
     * The web client polls this endpoint to display new vet responses.
     */
    r.get('/sessions/:sessionId', async (req, res) => {
        try {
            const session = await client.fetch(`/api/askvera/v1/sessions/${req.params.sessionId}`)
            res.json(session)
        } catch (err) {
            console.error('[GET /api/sessions/:id]', err.message)
            res.status(err.status ?? 500).json({error: err.message})
        }
    })

    /**
     * POST /api/sessions/:sessionId/convert-to-live
     *
     * Requests escalation from AI to a live veterinarian.
     *
     * Returns: updated session object
     */
    r.post('/sessions/:sessionId/convert-to-live', async (req, res) => {
        try {
            const result = await client.fetch(`/api/askvera/v1/sessions/${req.params.sessionId}/convert-to-live`, {
                method: 'POST',
                body: JSON.stringify({}),
            })
            res.json(result)
        } catch (err) {
            console.error('[POST /api/sessions/:id/convert-to-live]', err.message)
            if (err.body)
                console.error('[POST /api/sessions/:id/convert-to-live] upstream:', JSON.stringify(err.body, null, 2))
            res.status(err.status ?? 500).json({error: err.message})
        }
    })

    /**
     * POST /api/sessions/:sessionId/end
     *
     * Ends (closes) the current chat session.
     *
     * Returns: updated session object
     */
    r.post('/sessions/:sessionId/end', async (req, res) => {
        try {
            const result = await client.fetch(`/api/askvera/v1/sessions/${req.params.sessionId}/end`, {
                method: 'POST',
                body: JSON.stringify({}),
            })
            res.json(result)
        } catch (err) {
            console.error('[POST /api/sessions/:id/end]', err.message)
            res.status(err.status ?? 500).json({error: err.message})
        }
    })

    /**
     * POST /api/sessions/:sessionId/messages
     *
     * Sends a follow-up message in an existing session.
     * If imageUrl is provided, the image is included as an attachment.
     *
     * Body:    { userId, message, imageUrl? }
     * Returns: { sent: true }
     */
    r.post('/sessions/:sessionId/messages', async (req, res) => {
        const {userId, message, imageUrl} = req.body

        if (!userId || !message) {
            return res.status(400).json({error: 'userId and message are required'})
        }

        try {
            const result = await client.fetch(`/api/askvera/v1/sessions/${req.params.sessionId}/messages`, {
                method: 'POST',
                body: JSON.stringify({userId, message, ...(imageUrl && {imageUrl})}),
            })
            res.json(result)
        } catch (err) {
            console.error('[POST /api/sessions/:id/messages]', err.message)
            res.status(err.status ?? 500).json({error: err.message})
        }
    })

    /**
     * POST /api/sessions/:sessionId/images
     *
     * Uploads an image to AskVERA and returns the hosted URL.
     * The client should call this first, then send the returned URL
     * as `imageUrl` in the /messages endpoint.
     *
     * Body:    { imageUrl }   — a publicly accessible URL to the image
     * Returns: { url, thumbUrl }
     */
    r.post('/sessions/:sessionId/images', async (req, res) => {
        const {imageUrl} = req.body

        if (!imageUrl) {
            return res.status(400).json({error: 'imageUrl is required'})
        }

        try {
            const result = await client.fetch(`/api/askvera/v1/sessions/${req.params.sessionId}/images`, {
                method: 'POST',
                body: JSON.stringify({sessionId: req.params.sessionId, imageUrl}),
            })
            res.json(result)
        } catch (err) {
            console.error('[POST /api/sessions/:id/images]', err.message)
            res.status(err.status ?? 500).json({error: err.message})
        }
    })

    /**
     * POST /api/sessions/:sessionId/nps
     *
     * Submits an NPS (Net Promoter Score) rating (0–10) for a session.
     * Scores are categorized: promoter (9–10), passive (7–8), detractor (0–6).
     *
     * Body:    { userId, score, comment? }
     * Returns: { id, sessionId, score, comment, category, createdAt }
     */
    r.post('/sessions/:sessionId/nps', async (req, res) => {
        try {
            const result = await client.fetch(`/api/askvera/v1/sessions/${req.params.sessionId}/nps`, {
                method: 'POST',
                body: JSON.stringify(req.body),
            })
            res.json(result)
        } catch (err) {
            console.error('[POST /api/sessions/:id/nps]', err.message)
            res.status(err.status ?? 500).json({error: err.message})
        }
    })

    /**
     * POST /api/sessions/:sessionId/messages/:messageId/rate
     *
     * Rates an individual AI message (e.g. "helpful" or "unhelpful").
     *
     * Body:    { userId, rating, ratingCategory?, ratingComment? }
     * Returns: { id, messageId, sessionId, rating, ratingCategory, ratingComment, createdAt }
     */
    r.post('/sessions/:sessionId/messages/:messageId/rate', async (req, res) => {
        try {
            const result = await client.fetch(
                `/api/askvera/v1/sessions/${req.params.sessionId}/messages/${req.params.messageId}/rate`,
                {
                    method: 'POST',
                    body: JSON.stringify(req.body),
                },
            )
            res.json(result)
        } catch (err) {
            console.error('[POST /api/sessions/:id/messages/:mid/rate]', err.message)
            res.status(err.status ?? 500).json({error: err.message})
        }
    })

    /**
     * GET /api/sessions/:sessionId/message-ratings
     *
     * Lists all rated messages for a session.
     *
     * Returns: { items: [...], pagination: { total, offset, limit } }
     */
    r.get('/sessions/:sessionId/message-ratings', async (req, res) => {
        try {
            const qs = new URLSearchParams(req.query).toString()
            const path = `/api/askvera/v1/sessions/${req.params.sessionId}/message-ratings${qs ? '?' + qs : ''}`
            const result = await client.fetch(path)
            res.json(result)
        } catch (err) {
            console.error('[GET /api/sessions/:id/message-ratings]', err.message)
            res.status(err.status ?? 500).json({error: err.message})
        }
    })

    /**
     * POST /api/feedback
     *
     * Submits user feedback. Automatically creates a support ticket.
     *
     * Body:    { category, message, userId?, contactName?, contactEmail?, contactPhone?, platform?, appVersion? }
     * Returns: { id, ticketNumber, category, message, createdAt }
     */
    r.post('/feedback', async (req, res) => {
        try {
            const result = await client.fetch('/api/askvera/v1/feedback', {
                method: 'POST',
                body: JSON.stringify(req.body),
            })
            res.json(result)
        } catch (err) {
            console.error('[POST /api/feedback]', err.message)
            res.status(err.status ?? 500).json({error: err.message})
        }
    })

    return r
}

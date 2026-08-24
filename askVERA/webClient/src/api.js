/**
 * Thin fetch wrapper that talks to the example server.
 * The server holds the AskVERA credentials — this file never touches them.
 */
const BASE = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: {'Content-Type': 'application/json'},
        ...options,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
    return data
}

/** Create a user + pet + session and return their IDs */
export const startSession = ({firstName, lastName, email, postalCode, petName, species, breed, birthDate, question}) =>
    request('/api/sessions/start', {
        method: 'POST',
        body: JSON.stringify({firstName, lastName, email, postalCode, petName, species, breed, birthDate, question}),
    })

/** Fetch the session with all messages */
export const getSession = (sessionId) => request(`/api/sessions/${sessionId}`)

/** Send a follow-up message (optionally with an image attachment) */
export const sendMessage = (sessionId, userId, message, imageUrl) =>
    request(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({userId, message, ...(imageUrl && {imageUrl})}),
    })

/** Upload an image and return { url, thumbUrl } from AskVERA */
export const uploadImage = (sessionId, imageUrl) =>
    request(`/api/sessions/${sessionId}/images`, {
        method: 'POST',
        body: JSON.stringify({imageUrl}),
    })

/** Request escalation from AI to a live veterinarian */
export const convertToLive = (sessionId) =>
    request(`/api/sessions/${sessionId}/convert-to-live`, {
        method: 'POST',
        body: JSON.stringify({}),
    })

/** End (close) the current chat session */
export const endSession = (sessionId) =>
    request(`/api/sessions/${sessionId}/end`, {
        method: 'POST',
        body: JSON.stringify({}),
    })

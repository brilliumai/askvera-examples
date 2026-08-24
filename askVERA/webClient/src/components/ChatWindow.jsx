import {useEffect, useRef, useState} from 'react'
import {convertToLive, endSession, getSession, sendMessage, uploadImage} from '../api'
import MessageBubble from './MessageBubble'

const BASE = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
// Convert http(s) → ws(s) for the WebSocket URL
const WS_BASE = BASE.replace(/^http/, 'ws')

/** Fallback polling interval when WebSocket is unavailable */
const POLL_MS = 2500

const isAiSession = (type) => type === 'channel' || type === 'vendor'
const isLiveSession = (type) => type === 'live' || type === 'convertedToLive'

export default function ChatWindow({session, onNewChat}) {
    const [messages, setMessages] = useState([])
    const [sessionType, setSessionType] = useState(null)
    const [vetName, setVetName] = useState(null)
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [converting, setConverting] = useState(false)
    const [ending, setEnding] = useState(false)
    const [ended, setEnded] = useState(false)
    const fileInputRef = useRef(null)
    const bottomRef = useRef(null)
    const timerRef = useRef(null)

    const applySessionData = (data) => {
        setMessages(
            data.messages.map((m) => ({
                id: m.id,
                role: m.isVendorResponse ? 'vet' : 'user',
                text: m.message,
                authorName: m.authorName ?? null,
                outputURL: m.outputURL ?? null,
                createdAt: m.createdAt,
            })),
        )
        if (data.chatSessionType) setSessionType(data.chatSessionType)

        // Detect the live vet's name from the first vendor message that has an authorName
        // in a live session (authorName distinguishes a real vet from the AI bot)
        if (data.chatSessionType === 'live' || data.chatSessionType === 'convertedToLive') {
            const liveVetMsg = data.messages.find((m) => m.isVendorResponse && m.authorName)
            if (liveVetMsg?.authorName) setVetName(liveVetMsg.authorName)
        }
    }

    const loadMessages = async () => {
        try {
            const data = await getSession(session.sessionId)
            applySessionData(data)
        } catch (err) {
            console.error('Failed to fetch session:', err)
        }
    }

    useEffect(() => {
        // Primary: WebSocket push from the example server.
        // The server polls AskVERA and forwards session updates over WS,
        // so the browser never needs to hold credentials.
        //
        // Fallback: REST polling if WebSocket is unavailable.
        const ws = new WebSocket(`${WS_BASE}/ws?sessionId=${session.sessionId}`)

        ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data)
                if (payload.type === 'session.update') applySessionData(payload.session)
            } catch {}
        }

        ws.onopen = () => {
            console.log(`[AskVERA] WebSocket connected to ${WS_BASE}/ws`)
        }

        ws.onerror = () => {
            // WebSocket unavailable — fall back to REST polling
            console.warn(
                `[AskVERA] WebSocket connection to ${WS_BASE}/ws failed — falling back to REST polling.\n` +
                    `  Make sure the example server is running (cd server && npm run dev).\n` +
                    `  The web client connects to the EXAMPLE SERVER, not directly to the AskVERA API.\n` +
                    `  VITE_SERVER_URL should be http://localhost:3001 (the example server), NOT your AskVERA API URL.`,
            )
            if (!timerRef.current) {
                loadMessages()
                timerRef.current = setInterval(loadMessages, POLL_MS)
            }
        }

        return () => {
            ws.close()
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }, [session.sessionId])

    // Scroll to bottom whenever messages change
    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: 'smooth'})
    }, [messages])

    // Show the typing indicator while waiting for a reply
    // (true when the conversation is empty or the last message is from the user)
    const waitingForReply = messages.length === 0 || messages.at(-1)?.role === 'user'

    const handleSend = async (e) => {
        e.preventDefault()
        const text = input.trim()
        if (!text || sending) return

        setInput('')
        setSending(true)
        try {
            await sendMessage(session.sessionId, session.userId, text)
            await loadMessages()
        } catch (err) {
            console.error('Failed to send message:', err)
        } finally {
            setSending(false)
        }
    }

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        // Reset the input so the same file can be re-selected
        e.target.value = ''

        // Convert the file to a data URL for upload
        const reader = new FileReader()
        reader.onload = async () => {
            setUploading(true)
            try {
                const {url} = await uploadImage(session.sessionId, reader.result)
                // Send a message with the uploaded image attached
                const text = input.trim() || `Attached image: ${file.name}`
                setInput('')
                await sendMessage(session.sessionId, session.userId, text, url)
                await loadMessages()
            } catch (err) {
                console.error('Failed to upload image:', err)
            } finally {
                setUploading(false)
            }
        }
        reader.readAsDataURL(file)
    }

    const handleConvertToLive = async () => {
        setConverting(true)
        try {
            const updated = await convertToLive(session.sessionId)
            if (updated.chatSessionType) setSessionType(updated.chatSessionType)
        } catch (err) {
            console.error('Failed to request live vet:', err)
        } finally {
            setConverting(false)
        }
    }

    const handleEndChat = async () => {
        setEnding(true)
        try {
            await endSession(session.sessionId)
            setEnded(true)
        } catch (err) {
            console.error('Failed to end session:', err)
        } finally {
            setEnding(false)
        }
    }

    const handleNewChat = async () => {
        if (!ended) {
            try {
                await endSession(session.sessionId)
            } catch (err) {
                console.error('Failed to end session before starting new chat:', err)
            }
        }
        onNewChat()
    }

    const live = isLiveSession(sessionType)
    const ai = isAiSession(sessionType)

    return (
        <div className="chat-root">
            {/* ── Header ── */}
            <header className="chat-header">
                <div className="chat-header-left">
                    <div className="chat-logo" aria-hidden="true">
                        🐾
                    </div>
                    <div>
                        <span className="chat-title">Ask VERA</span>
                        <span className="chat-subtitle">
                            {live
                                ? vetName
                                    ? 'Live Veterinary Session'
                                    : 'Connecting to Live Vet…'
                                : 'Veterinary Expert Response Assistant'}
                        </span>
                    </div>
                    {sessionType && (
                        <span
                            className={`session-badge ${
                                live ? (vetName ? 'session-badge-live' : 'session-badge-pending') : 'session-badge-ai'
                            }`}
                        >
                            {live ? (vetName ? '● Live' : '● Connecting…') : '● AI'}
                        </span>
                    )}
                </div>
                <div className="chat-header-actions">
                    {!ended && (
                        <button className="btn-end" onClick={handleEndChat} disabled={ending}>
                            {ending ? 'Ending…' : 'End Chat'}
                        </button>
                    )}
                    <button className="btn-new" onClick={handleNewChat} disabled={ending}>
                        + New Chat
                    </button>
                </div>
            </header>

            {/* ── Messages ── */}
            <main className="chat-messages">
                {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                ))}

                {/* Typing indicator — visible while waiting for a reply */}
                {waitingForReply && (
                    <div className="msg-row msg-vet">
                        <div className="msg-avatar" aria-hidden="true">
                            {live ? '👨‍⚕️' : '🩺'}
                        </div>
                        <div className="msg-content">
                            <div className="bubble typing-bubble">
                                <span className="dot" />
                                <span className="dot" />
                                <span className="dot" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </main>

            {/* ── Live vet CTA — shown when session is AI type ── */}
            {ai && (
                <div className="live-cta">
                    <span>Want to speak with a live veterinarian?</span>
                    <button className="btn-live" onClick={handleConvertToLive} disabled={converting}>
                        {converting ? 'Requesting…' : 'Request Live Vet →'}
                    </button>
                </div>
            )}

            {/* ── Pending live / connected — shown while connecting or once vet joins ── */}
            {live && (
                <div className={`live-cta ${vetName ? 'live-cta-connected' : 'live-cta-pending'}`}>
                    {vetName ? (
                        <span>Chatting with {vetName}</span>
                    ) : (
                        <>
                            <span className="spinner spinner-muted" />
                            <span>Connecting you to a live veterinarian…</span>
                        </>
                    )}
                </div>
            )}

            {/* ── Ended banner ── */}
            {ended && (
                <div className="live-cta live-cta-ended">
                    <span>This session has ended.</span>
                    <button className="btn-new" onClick={onNewChat}>
                        Start New Chat
                    </button>
                </div>
            )}

            {/* ── Input ── */}
            {!ended && (
                <form className="chat-input-row" onSubmit={handleSend}>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" hidden />
                    <button
                        className="chat-attach-btn"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sending || uploading}
                        aria-label="Attach image"
                    >
                        {uploading ? <span className="spinner spinner-small" /> : <PaperclipIcon />}
                    </button>
                    <input
                        className="chat-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={`Follow-up about ${session.petName}…`}
                        disabled={sending || uploading}
                        autoComplete="off"
                    />
                    <button
                        className="chat-send-btn"
                        type="submit"
                        disabled={!input.trim() || sending || uploading}
                        aria-label="Send message"
                    >
                        <SendIcon />
                    </button>
                </form>
            )}
        </div>
    )
}

function PaperclipIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="18"
            height="18"
            aria-hidden="true"
        >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
        </svg>
    )
}

function SendIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="18"
            height="18"
            aria-hidden="true"
        >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
    )
}

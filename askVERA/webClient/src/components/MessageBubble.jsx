const fmt = (iso) => new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})

/**
 * A single message bubble.
 * `message.role` is either 'user' or 'vet'.
 * `message.outputURL` is an optional image URL attached to the message.
 */
export default function MessageBubble({message}) {
    const isVet = message.role === 'vet'
    return (
        <div className={`msg-row ${isVet ? 'msg-vet' : 'msg-user'}`}>
            {isVet && (
                <div className="msg-avatar" aria-hidden="true">
                    🩺
                </div>
            )}
            <div className="msg-content">
                {message.outputURL && (
                    <a href={message.outputURL} target="_blank" rel="noopener noreferrer" className="msg-image-link">
                        <img src={message.outputURL} alt="Attachment" className="msg-image" />
                    </a>
                )}
                <div className="bubble">{message.text}</div>
                <time className="msg-time">{fmt(message.createdAt)}</time>
            </div>
        </div>
    )
}

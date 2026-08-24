import {useState} from 'react'
import SetupForm from './components/SetupForm'
import ChatWindow from './components/ChatWindow'

/**
 * Top-level state machine:
 *   null session  →  SetupForm  (collect pet info + opening question)
 *   active session →  ChatWindow (chat with the vet bot)
 */
export default function App() {
    const [session, setSession] = useState(null)

    return session ? (
        <ChatWindow session={session} onNewChat={() => setSession(null)} />
    ) : (
        <SetupForm onStart={setSession} />
    )
}

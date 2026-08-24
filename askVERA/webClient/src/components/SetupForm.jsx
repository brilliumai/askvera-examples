import {useState} from 'react'
import {startSession} from '../api'

const SPECIES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Reptile', 'Other']

export default function SetupForm({onStart}) {
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        postalCode: '',
        petName: '',
        species: 'Dog',
        birthDate: '',
        question: '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const set = (key) => (e) => setForm((f) => ({...f, [key]: e.target.value}))

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const data = await startSession(form)
            onStart({...data, petName: form.petName})
        } catch (err) {
            setError(err.message)
            setLoading(false)
        }
    }

    return (
        <div className="setup-bg">
            <div className="setup-card">
                <header className="setup-header">
                    <div className="setup-logo">🐾</div>
                    <h1>Ask VERA</h1>
                    <p>Get expert veterinary guidance for your pet</p>
                </header>

                <form onSubmit={handleSubmit} className="setup-form">
                    <div className="field-row">
                        <div className="field">
                            <label htmlFor="firstName">First Name</label>
                            <input
                                id="firstName"
                                type="text"
                                placeholder="Jane"
                                value={form.firstName}
                                onChange={set('firstName')}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="lastName">Last Name</label>
                            <input
                                id="lastName"
                                type="text"
                                placeholder="Smith"
                                value={form.lastName}
                                onChange={set('lastName')}
                                required
                            />
                        </div>
                    </div>

                    <div className="field-row">
                        <div className="field">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="jane@example.com"
                                value={form.email}
                                onChange={set('email')}
                                required
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="postalCode">Postal Code</label>
                            <input
                                id="postalCode"
                                type="text"
                                placeholder="90210"
                                value={form.postalCode}
                                onChange={set('postalCode')}
                                required
                            />
                        </div>
                    </div>

                    <div className="field-row">
                        <div className="field">
                            <label htmlFor="petName">Pet's Name</label>
                            <input
                                id="petName"
                                type="text"
                                placeholder="Max"
                                value={form.petName}
                                onChange={set('petName')}
                                required
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="species">Species</label>
                            <select id="species" value={form.species} onChange={set('species')}>
                                {SPECIES.map((s) => (
                                    <option key={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="field-row">
                        <div className="field">
                            <label htmlFor="birthDate">Date of Birth</label>
                            <input
                                id="birthDate"
                                type="date"
                                value={form.birthDate}
                                onChange={set('birthDate')}
                                required
                            />
                        </div>
                    </div>

                    <div className="field">
                        <label htmlFor="question">What's your question?</label>
                        <textarea
                            id="question"
                            placeholder={`Describe what's going on with ${form.petName || 'your pet'}…`}
                            value={form.question}
                            onChange={set('question')}
                            required
                            rows={3}
                        />
                    </div>

                    {error && <div className="error-banner">⚠️ {error}</div>}

                    <button className="btn-start" type="submit" disabled={loading}>
                        {loading ? (
                            <span className="btn-loading">
                                <span className="spinner" />
                                Connecting…
                            </span>
                        ) : (
                            'Start Chat →'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}

import { useState } from 'react'
import { startInterview } from '../api'

const TONES = [
  'natural, honest, conversational',
  'professional and polished',
  'raw and unfiltered',
]

const DURATIONS = ['30 seconds', '60 seconds', '2 minutes']

const TONE_ICONS = {
  'natural, honest, conversational': '💬',
  'professional and polished': '🎯',
  'raw and unfiltered': '🔥',
}


export default function Setup({ onStart }) {
  const [form, setForm] = useState({
    topic: '',
    target_audience: '',
    video_goal: '',
    tone: TONES[0],
    target_duration: DURATIONS[1],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.topic.trim()) {
      setError('Please enter a topic to get started.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await startInterview(form)
      onStart({
        session_id: res.session_id,
        config: form,
        first_question: res.question,
      })
    } catch (err) {
      setError(err.message || 'Failed to start the interview. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page page--setup fade-in">
      {/* Hero */}
      <header className="setup-hero">
        <div className="setup-badge">
          <span className="setup-badge__dot" />
          AI-Powered Interview
        </div>
        <h1 className="setup-title">
          Turn your thoughts into a
          <span className="gradient-text"> video-ready script</span>
        </h1>
        <p className="setup-subtitle">
          Answer a few AI-driven questions. Get a polished script that sounds like <em>you</em> — 
          not like a chatbot wrote it.
        </p>
      </header>

      {/* Form Card */}
      <form className="card glass-card" onSubmit={submit} id="setup-form">
        {/* Topic */}
        <div className="form-group">
          <label htmlFor="input-topic" className="form-label">
            Topic <span className="required">*</span>
          </label>
          <input
            id="input-topic"
            type="text"
            value={form.topic}
            onChange={set('topic')}
            placeholder="e.g. Why I avoided posting videos for 2 years"
            autoFocus
            className="form-input"
          />
        </div>

        {/* Target Audience */}
        <div className="form-group">
          <label htmlFor="input-audience" className="form-label">
            Target Audience
          </label>
          <input
            id="input-audience"
            type="text"
            value={form.target_audience}
            onChange={set('target_audience')}
            placeholder="e.g. founders and professionals"
            className="form-input"
          />
        </div>

        {/* Video Goal */}
        <div className="form-group">
          <label htmlFor="input-goal" className="form-label">
            Video Goal
          </label>
          <input
            id="input-goal"
            type="text"
            value={form.video_goal}
            onChange={set('video_goal')}
            placeholder="e.g. Build trust by sharing a personal fear"
            className="form-input"
          />
        </div>

        {/* Tone */}
        <div className="form-group">
          <label htmlFor="input-tone" className="form-label">
            Tone
          </label>
          <div className="tone-grid">
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                className={`tone-option ${form.tone === t ? 'tone-option--active' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, tone: t }))}
              >
                <span className="tone-icon">{TONE_ICONS[t]}</span>
                <span className="tone-label">{t}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="form-group">
          <label className="form-label">Target Duration</label>
          <div className="seg-group">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={`seg-btn ${form.target_duration === d ? 'seg-btn--active' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, target_duration: d }))}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="error-box" role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="btn-primary btn-primary--lg"
          disabled={loading}
          id="btn-start-interview"
        >
          {loading ? (
            <>
              <span className="spinner" />
              Starting…
            </>
          ) : (
            <>
              Begin Interview
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </form>

      {/* Features */}
      <div className="features-row">
        <div className="feature-chip">
          <span>🎙️</span> Voice or text input
        </div>
        <div className="feature-chip">
          <span>🤖</span> Adaptive AI questions
        </div>
        <div className="feature-chip">
          <span>📝</span> Instant script output
        </div>
      </div>
    </div>
  )
}

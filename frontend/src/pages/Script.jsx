import { useState, useEffect } from 'react'
import { generateScript } from '../api'

const DURATIONS = ['30 seconds', '60 seconds', '2 minutes']

const DURATION_LABELS = {
  '30 seconds': '30s',
  '60 seconds': '1 min',
  '2 minutes': '2 min',
}

export default function Script({ session, transcript, scriptData, setScriptData, onRestart }) {
  const [duration, setDuration] = useState(session.config.target_duration)
  const [loading, setLoading] = useState(!scriptData)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showDiscarded, setShowDiscarded] = useState(false)
  useEffect(() => {
    if (!scriptData) {
      generate(duration)
    }
  }, [])

  async function generate(d) {
    setLoading(true)
    setError('')
    try {
      const result = await generateScript(
        session.session_id,
        d,
        'founder-style short video'
      )
      setScriptData(result)
    } catch (err) {
      setError(err.message || 'Failed to generate script.')
    } finally {
      setLoading(false)
    }
  }

  const switchDuration = (d) => {
    setDuration(d)
    setScriptData(null)
    generate(d)
  }

  const copyToClipboard = async () => {
    if (!scriptData?.short_video_script) return
    try {
      await navigator.clipboard.writeText(scriptData.short_video_script)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = scriptData.short_video_script
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadTxt = () =>
    downloadFile(scriptData.short_video_script, 'video_script.txt', 'text/plain')

  const downloadJson = () =>
    downloadFile(
      JSON.stringify({ ...scriptData, transcript }, null, 2),
      'interview_output.json',
      'application/json'
    )

  return (
    <div className="page page--script fade-in">
      {/* Header */}
      <header className="script-header">
        <div className="script-header__left">
          <div className="script-header__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div>
            <h1 className="script-header__title">Your Video Script</h1>
            <p className="script-header__subtitle">
              AI-generated from your interview on <em>"{session.config.topic}"</em>
            </p>
          </div>
        </div>
      </header>

      {/* Duration Switcher */}
      <div className="duration-switcher">
        <span className="duration-switcher__label">Script length</span>
        <div className="seg-group">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`seg-btn ${duration === d ? 'seg-btn--active' : ''}`}
              onClick={() => switchDuration(d)}
              disabled={loading}
              id={`btn-duration-${d.replace(/\s/g, '-')}`}
            >
              {DURATION_LABELS[d]}
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

      {/* Loading */}
      {loading && (
        <div className="script-loading glass-card">
          <div className="script-loading__spinner">
            <span className="spinner spinner--lg" />
          </div>
          <p className="script-loading__text">Crafting your {duration} script…</p>
          <p className="script-loading__sub">Analyzing your interview for the best moments</p>
        </div>
      )}

      {/* Script Content */}
      {!loading && scriptData && (
        <>
          {/* Main Script Card */}
          <div className="script-card glass-card slide-up">
            {/* Meta badges */}
            <div className="script-meta">
              <span className="meta-badge meta-badge--accent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                ~{scriptData.estimated_seconds}s
              </span>
              <span className="meta-badge meta-badge--accent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7V4h16v3M9 20h6M12 4v16" />
                </svg>
                {scriptData.word_count} words
              </span>
              <span className="meta-badge meta-badge--dim">
                {duration}
              </span>
            </div>

            {/* Script text */}
            <div className="script-text-container">
              <p className="script-text">{scriptData.short_video_script}</p>
            </div>

            {/* Action buttons */}
            <div className="script-actions">
              <button
                className={`btn-secondary ${copied ? 'btn-secondary--success' : ''}`}
                onClick={copyToClipboard}
                id="btn-copy-script"
              >
                {copied ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy Script
                  </>
                )}
              </button>
              <button className="btn-secondary" onClick={downloadTxt} id="btn-download-txt">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download TXT
              </button>
              <button className="btn-secondary" onClick={downloadJson} id="btn-download-json">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download JSON
              </button>
            </div>
          </div>

          {/* Selected Moments */}
          {scriptData.selected_moments?.length > 0 && (
            <section className="moments-section slide-up" style={{ animationDelay: '0.1s' }}>
              <h2 className="section-title">
                <span className="section-title__icon section-title__icon--green">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                Selected Moments
                <span className="section-title__count">{scriptData.selected_moments.length}</span>
              </h2>
              <div className="moments-list">
                {scriptData.selected_moments.map((m, i) => (
                  <div key={i} className="moment-card moment-card--selected">
                    <blockquote className="moment-card__quote">"{m.source_text}"</blockquote>
                    <p className="moment-card__reason">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      {m.reason}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Discarded Moments */}
          {scriptData.discarded_moments?.length > 0 && (
            <section className="moments-section slide-up" style={{ animationDelay: '0.2s' }}>
              <button
                className="section-title section-title--collapsible"
                onClick={() => setShowDiscarded(!showDiscarded)}
                id="btn-toggle-discarded"
              >
                <span className="section-title__icon section-title__icon--muted">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
                Discarded Moments
                <span className="section-title__count">{scriptData.discarded_moments.length}</span>
                <svg
                  className={`section-title__chevron ${showDiscarded ? 'section-title__chevron--open' : ''}`}
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showDiscarded && (
                <div className="moments-list fade-in">
                  {scriptData.discarded_moments.map((m, i) => (
                    <div key={i} className="moment-card moment-card--discarded">
                      <blockquote className="moment-card__quote">"{m.source_text}"</blockquote>
                      <p className="moment-card__reason">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        {m.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Restart */}
          <div className="script-footer slide-up" style={{ animationDelay: '0.3s' }}>
            <button className="btn-ghost" onClick={onRestart} id="btn-new-interview">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              Start New Interview
            </button>
          </div>
        </>
      )}
    </div>
  )
}

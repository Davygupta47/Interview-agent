import { useState, useEffect, useRef, useCallback } from 'react'
import { sendAnswer } from '../api'
import { createMic } from '../speech'
import { speakText, cancelSpeech, isTTSSupported } from '../tts'


export default function Interview({ session, onComplete, onExit }) {
  const { session_id, first_question, config } = session
  const isVoiceMode = config.interview_mode === 'voice'

  const [turns, setTurns] = useState([first_question])
  const [answer, setAnswer] = useState('')
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [micSupported, setMicSupported] = useState(true)
  const [turnCount, setTurnCount] = useState(1)
  const [agentSpeaking, setAgentSpeaking] = useState(false)

  const micRef = useRef(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const mountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cancelSpeech()
      if (micRef.current) {
        try { micRef.current.stop() } catch {}
      }
    }
  }, [])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, loading, agentSpeaking])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [answer])

  // Voice mode: speak the first question on mount
  useEffect(() => {
    if (isVoiceMode && first_question?.text && isTTSSupported()) {
      speakQuestion(first_question.text)
    }
  }, [])

  /**
   * Speak a question aloud, then auto-start mic if in voice mode.
   */
  const speakQuestion = useCallback(async (text) => {
    if (!isTTSSupported()) return
    setAgentSpeaking(true)
    try {
      await speakText(text, { rate: 0.92, pitch: 1.0 })
    } catch {}
    if (!mountedRef.current) return
    setAgentSpeaking(false)

    // Auto-start mic after agent finishes speaking in voice mode
    if (isVoiceMode) {
      startMicRecording()
    }
  }, [isVoiceMode])

  /**
   * Initialize and start the mic.
   */
  const startMicRecording = useCallback(() => {
    if (!micRef.current) {
      micRef.current = createMic(
        (interim) => setAnswer(interim),
        (final) => {
          setAnswer(final)
          setRecording(false)
        }
      )
      if (!micRef.current) {
        setMicSupported(false)
        return
      }
    }
    setAnswer('')
    micRef.current.start()
    setRecording(true)
  }, [])

  const submit = useCallback(
    async (text, source = 'typed') => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      // Stop mic if recording
      if (recording && micRef.current) {
        micRef.current.stop()
        setRecording(false)
      }

      setTurns((prev) => [
        ...prev,
        { speaker: 'user', text: trimmed, answer_source: source },
      ])
      setAnswer('')
      setError('')
      setLoading(true)

      try {
        const res = await sendAnswer(session_id, trimmed, source)
        if (!mountedRef.current) return
        setTurns((prev) => [...prev, res.question])
        setTurnCount(res.turn_count)

        // Voice mode: speak the new question
        if (isVoiceMode && res.question?.text) {
          // Small delay for visual transition
          setTimeout(() => {
            if (mountedRef.current) speakQuestion(res.question.text)
          }, 400)
        }

        if (res.interview_complete) {
          cancelSpeech()
          setTimeout(() => onComplete(res.transcript), 1500)
        }
      } catch (err) {
        if (!mountedRef.current) return
        setError(err.message || 'Failed to get next question.')
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [session_id, loading, recording, onComplete, isVoiceMode, speakQuestion]
  )

  const toggleMic = useCallback(() => {
    if (!micRef.current) {
      micRef.current = createMic(
        (interim) => setAnswer(interim),
        (final) => {
          setAnswer(final)
          setRecording(false)
        }
      )
      if (!micRef.current) {
        setMicSupported(false)
        return
      }
    }

    if (recording) {
      micRef.current.stop()
      setRecording(false)
    } else {
      // Cancel agent speech if user wants to talk
      cancelSpeech()
      setAgentSpeaking(false)
      setAnswer('')
      micRef.current.start()
      setRecording(true)
    }
  }, [recording])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit(answer, recording ? 'mic_transcription' : 'typed')
    }
  }

  const maxTurns = 15
  const progressPercent = Math.min((turnCount / maxTurns) * 100, 100)

  const handleExit = () => {
    cancelSpeech()
    if (micRef.current) {
      try { micRef.current.stop() } catch {}
    }
    if (onExit) onExit()
  }

  return (
    <div className="interview-layout fade-in">
      {/* Header */}
      <header className="interview-header">
        <div className="interview-header__left">
          <div className="interview-header__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="interview-header__title">
              {isVoiceMode ? '🎙️ Voice Interview' : 'Interview in Progress'}
            </h2>
            <p className="interview-header__topic">{config.topic}</p>
          </div>
        </div>
        <div className="interview-header__right">
          <div className="turn-badge">
            <span className="turn-badge__count">Turn {turnCount}</span>
            <span className="turn-badge__max">of ~{maxTurns}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar__fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <button
            type="button"
            className="btn-exit"
            onClick={handleExit}
            title="Exit interview"
            id="btn-exit-interview"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Exit
          </button>
        </div>
      </header>

      {/* Transcript scroll area */}
      <div className="transcript-scroll">
        <div className="transcript-inner">
          {turns.map((turn, i) => (
            <div
              key={i}
              className={`bubble bubble--${turn.speaker} slide-up`}
              style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
            >
              <div className="bubble__header">
                <span className="bubble__avatar">
                  {turn.speaker === 'interviewer' ? '🎧' : '👤'}
                </span>
                <span className="bubble__label">
                  {turn.speaker === 'interviewer' ? 'AI Interviewer' : 'You'}
                </span>
                {turn.answer_source === 'mic_transcription' && (
                  <span className="bubble__mic-tag">🎙️ voice</span>
                )}
              </div>
              <p className="bubble__text">{turn.text}</p>
              {turn.reason && (
                <span className="bubble__reason">{turn.reason}</span>
              )}
            </div>
          ))}

          {/* Agent speaking indicator */}
          {agentSpeaking && !loading && (
            <div className="bubble bubble--interviewer slide-up agent-speaking-bubble">
              <div className="bubble__header">
                <span className="bubble__avatar">🎧</span>
                <span className="bubble__label">AI Interviewer</span>
                <span className="bubble__speaking-tag">🔊 speaking…</span>
              </div>
              <div className="speaking-wave">
                <span /><span /><span /><span /><span />
              </div>
            </div>
          )}

          {/* Thinking indicator */}
          {loading && (
            <div className="bubble bubble--interviewer slide-up">
              <div className="bubble__header">
                <span className="bubble__avatar">🎧</span>
                <span className="bubble__label">AI Interviewer</span>
              </div>
              <div className="thinking-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Answer bar */}
      <div className="answer-bar">
        {error && (
          <div className="error-box error-box--compact" role="alert">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {/* Voice mode: big mic button + optional text area */}
        {isVoiceMode ? (
          <div className="answer-bar__voice-mode">
            <div className="answer-bar__voice-center">
              <button
                type="button"
                className={`btn-mic-large ${recording ? 'btn-mic-large--active' : ''} ${agentSpeaking ? 'btn-mic-large--disabled' : ''}`}
                onClick={toggleMic}
                disabled={loading || agentSpeaking}
                title={recording ? 'Stop recording & send' : agentSpeaking ? 'Wait for agent to finish' : 'Start speaking'}
                id="btn-mic-voice-mode"
              >
                {recording ? (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>
              <span className="voice-mode-hint">
                {agentSpeaking
                  ? 'Listening to interviewer…'
                  : recording
                    ? 'Speaking… tap to stop & send'
                    : loading
                      ? 'Thinking…'
                      : 'Tap to speak your answer'}
              </span>
            </div>

            {/* Transcript / typed fallback for voice mode */}
            {(answer || recording) && (
              <div className="voice-transcript-preview">
                <p className="voice-transcript-text">{answer || '…'}</p>
              </div>
            )}

            {/* Send button if there's text (from mic or typed) */}
            {answer.trim() && !recording && (
              <button
                type="button"
                className="btn-primary btn-primary--lg"
                onClick={() => submit(answer, 'mic_transcription')}
                disabled={loading}
                id="btn-send-voice"
              >
                Send Answer
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          /* Text mode: original layout */
          <div className="answer-bar__input-row">
            <textarea
              ref={textareaRef}
              value={answer}
              rows={1}
              disabled={loading}
              placeholder={
                recording
                  ? '🎙️ Listening… speak now'
                  : 'Type your answer, or use the mic…'
              }
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              className="answer-textarea"
              id="answer-input"
            />
            <div className="answer-bar__actions">
              {micSupported && (
                <button
                  type="button"
                  className={`btn-icon btn-mic ${recording ? 'btn-mic--active' : ''}`}
                  onClick={toggleMic}
                  title={recording ? 'Stop recording' : 'Start voice input'}
                  id="btn-mic-toggle"
                >
                  {recording ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </button>
              )}
              <button
                type="button"
                className="btn-primary btn-send"
                onClick={() =>
                  submit(answer, recording ? 'mic_transcription' : 'typed')
                }
                disabled={loading || !answer.trim() || recording}
                id="btn-send-answer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

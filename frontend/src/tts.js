/**
 * Text-to-Speech utility using the browser's SpeechSynthesis API.
 * No API key required — works in all modern browsers.
 *
 * Provides:
 *   speakText(text, opts) → Promise that resolves when speech ends
 *   cancelSpeech()        → Stop any ongoing speech
 *   isSpeaking()          → Check if TTS is active
 */

let _preferredVoice = null
let _voicesLoaded = false

/**
 * Pick the best available English voice.
 * Preference order: Google UK Female > Google US > any en-* voice > default.
 */
function _loadPreferredVoice() {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  // Ranked preferences
  const prefs = [
    (v) => v.name.includes('Google UK English Female'),
    (v) => v.name.includes('Google US English'),
    (v) => v.name.includes('Google') && v.lang.startsWith('en'),
    (v) => v.name.includes('Samantha'),          // macOS natural
    (v) => v.name.includes('Daniel'),             // macOS natural
    (v) => v.name.includes('Microsoft Zira'),     // Windows
    (v) => v.name.includes('Microsoft Mark'),     // Windows
    (v) => v.lang.startsWith('en') && v.localService === false,
    (v) => v.lang.startsWith('en'),
  ]

  for (const test of prefs) {
    const match = voices.find(test)
    if (match) return match
  }

  return voices[0]
}

function _ensureVoice() {
  if (!_voicesLoaded) {
    _preferredVoice = _loadPreferredVoice()
    _voicesLoaded = !!_preferredVoice
  }
  return _preferredVoice
}

// Voices load async in some browsers
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    _preferredVoice = _loadPreferredVoice()
    _voicesLoaded = true
  }
  // Trigger initial load
  window.speechSynthesis.getVoices()
}

/**
 * Speak text aloud using the browser's SpeechSynthesis API.
 *
 * @param {string} text    - The text to speak
 * @param {object} [opts]  - Options
 * @param {number} [opts.rate=0.95]   - Speech rate (0.1 – 10)
 * @param {number} [opts.pitch=1.0]   - Pitch (0 – 2)
 * @param {number} [opts.volume=1.0]  - Volume (0 – 1)
 * @returns {Promise<void>} Resolves when speech ends, rejects on error
 */
export function speakText(text, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      console.warn('SpeechSynthesis not supported')
      resolve()
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)

    const voice = _ensureVoice()
    if (voice) utterance.voice = voice

    utterance.rate = opts.rate ?? 0.95
    utterance.pitch = opts.pitch ?? 1.0
    utterance.volume = opts.volume ?? 1.0
    utterance.lang = 'en-US'

    utterance.onend = () => resolve()
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') {
        resolve() // Not a real error
      } else {
        console.warn('SpeechSynthesis error:', event.error)
        resolve() // Resolve anyway so the app doesn't hang
      }
    }

    window.speechSynthesis.speak(utterance)
  })
}

/**
 * Cancel any ongoing speech immediately.
 */
export function cancelSpeech() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

/**
 * Check if TTS is currently speaking.
 * @returns {boolean}
 */
export function isSpeaking() {
  return window.speechSynthesis?.speaking ?? false
}

/**
 * Check if TTS is supported in this browser.
 * @returns {boolean}
 */
export function isTTSSupported() {
  return typeof window !== 'undefined' && !!window.speechSynthesis
}

/**
 * Create a microphone recognizer using the browser's Web Speech API.
 * Returns null if the browser doesn't support it.
 *
 * @param {(interim: string) => void} onInterim - Called with live transcript text
 * @param {(final: string) => void} onFinal - Called with final transcript when stopped
 * @returns {{ start: () => void, stop: () => void } | null}
 */
export function createMic(onInterim, onFinal) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition

  if (!SpeechRecognition) return null

  const recognition = new SpeechRecognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'

  let finalTranscript = ''

  recognition.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalTranscript += text + ' '
      } else {
        interim += text
      }
    }
    onInterim(finalTranscript + interim)
  }

  recognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error)
    if (event.error !== 'no-speech') {
      onFinal(finalTranscript.trim())
    }
  }

  recognition.onend = () => {
    onFinal(finalTranscript.trim())
  }

  return {
    start: () => {
      finalTranscript = ''
      recognition.start()
    },
    stop: () => {
      recognition.stop()
    },
  }
}

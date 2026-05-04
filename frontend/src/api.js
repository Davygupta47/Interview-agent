/* ─── API Utility — all fetch wrappers for the FastAPI backend ─── */

/**
 * Start a new interview session.
 * POST /api/interview/start
 */
export const startInterview = (config) =>
  post('/api/interview/start', config)

/**
 * Send a user answer and get the next AI question.
 * POST /api/interview/next
 */
export const sendAnswer = (session_id, user_answer, answer_source = 'typed') =>
  post('/api/interview/next', { session_id, user_answer, answer_source })

/**
 * Generate a video script from the interview.
 * POST /api/script/generate
 */
export const generateScript = (session_id, target_duration, style = 'founder-style short video') =>
  post('/api/script/generate', { session_id, target_duration, style })

/**
 * Get the full transcript for a session.
 * GET /api/interview/:id/transcript
 */
export const getTranscript = (session_id) =>
  fetch(`/api/interview/${session_id}/transcript`).then(handleResponse)

/**
 * Health check.
 * GET /api/health
 */
export const checkHealth = () =>
  fetch('/api/health').then(handleResponse)

/* ─── Internals ─── */

function post(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handleResponse)
}

function handleResponse(res) {
  if (res.ok) return res.json()
  return res.text().then((text) => {
    let message = text
    try {
      const parsed = JSON.parse(text)
      message = parsed.detail || parsed.message || text
    } catch {
      /* use raw text */
    }
    throw new Error(message)
  })
}

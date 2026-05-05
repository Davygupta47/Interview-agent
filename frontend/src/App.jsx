import { useState, useCallback } from 'react'
import Setup from './pages/Setup'
import Interview from './pages/Interview'
import Script from './pages/Script'


export default function App() {
  const [page, setPage] = useState('setup')
  const [session, setSession] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [scriptData, setScriptData] = useState(null)

  const handleStart = useCallback((sessionData) => {
    setSession(sessionData)
    setPage('interview')
  }, [])

  const handleInterviewComplete = useCallback((transcriptData) => {
    setTranscript(transcriptData)
    setScriptData(null)
    setPage('script')
  }, [])

  const handleRestart = useCallback(() => {
    setPage('setup')
    setSession(null)
    setTranscript([])
    setScriptData(null)
  }, [])

  return (
    <div className="app">
      <div className="bg-glow bg-glow--1" aria-hidden="true" />
      <div className="bg-glow bg-glow--2" aria-hidden="true" />

      {page === 'setup' && (
        <Setup onStart={handleStart} />
      )}

      {page === 'interview' && session && (
        <Interview
          session={session}
          onComplete={handleInterviewComplete}
          onExit={handleRestart}
        />
      )}

      {page === 'script' && session && (
        <Script
          session={session}
          transcript={transcript}
          scriptData={scriptData}
          setScriptData={setScriptData}
          onRestart={handleRestart}
        />
      )}
    </div>
  )
}

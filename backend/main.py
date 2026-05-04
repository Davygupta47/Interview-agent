from __future__ import annotations

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import sessions
import agents
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-7s │ %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run checks on startup, clean up on shutdown."""
    logger.info("=" * 50)
    logger.info("AI Interviewer API — starting up")
    logger.info("=" * 50)

    try:
        agents.check_llm_configured()
        logger.info("LLM provider verified ✓")
    except RuntimeError as e:
        logger.error("LLM config error: %s", e)
        logger.error("The server will start but LLM calls will fail.")
        logger.error("Fix your .env file and restart.")

    logger.info("Server ready — accepting requests")

    yield  
    expired = sessions.cleanup_expired()
    logger.info("Shutdown — cleaned up %d expired sessions", expired)
    logger.info("Goodbye.")

app = FastAPI(
    title="AI Interviewer API",
    description="Adaptive AI Interviewer + Short Video Script Generator",
    version="1.0.0",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
extra_origin = os.getenv("CORS_ORIGIN", "").strip()
if extra_origin:
    ALLOWED_ORIGINS.append(extra_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle LLM parsing errors and validation issues gracefully."""
    logger.warning("ValueError on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc)},
    )


@app.exception_handler(RuntimeError)
async def runtime_error_handler(request: Request, exc: RuntimeError):
    """Handle LLM config errors."""
    logger.error("RuntimeError on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={"detail": str(exc)},
    )


@app.exception_handler(Exception)
async def general_error_handler(request: Request, exc: Exception):
    """Catch-all — never leak raw tracebacks to the client."""
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )


class StartReq(BaseModel):
    """Config to kick off a new interview session."""
    topic: str = Field(..., min_length=1, max_length=500)
    target_audience: str = Field(default="", max_length=300)
    video_goal: str = Field(default="", max_length=500)
    tone: str = Field(default="natural, honest, conversational", max_length=200)
    target_duration: str = Field(default="60 seconds", max_length=50)
    interview_mode: str = Field(
        default="text",
        description="Interview input mode: 'voice' or 'text'",
        max_length=10,
    )


class AnswerReq(BaseModel):
    """User's answer to the current interview question."""
    session_id: str = Field(..., min_length=1, max_length=50)
    user_answer: str = Field(..., min_length=1, max_length=10000)
    answer_source: str = Field(
        default="typed",
        description="typed | mic_transcription",
        max_length=30,
    )


class ScriptReq(BaseModel):
    """Request to generate a video script from a completed interview."""
    session_id: str = Field(..., min_length=1, max_length=50)
    target_duration: str = Field(default="60 seconds", max_length=50)
    style: str = Field(default="founder-style short video", max_length=200)


@app.post("/api/interview/start")
async def start_interview(req: StartReq):
    """
    Create a new interview session and return the first AI question.
    """
    config = req.model_dump()
    sid = sessions.create(config)
    logger.info("Session %s created — topic: %s", sid, config["topic"][:60])

    result = await agents.get_next_question(config, [])

    entry = {
        "speaker": "interviewer",
        "text": result["text"],
        "question_type": result.get("question_type", "opening"),
        "reason": result.get("reason", ""),
    }
    sessions.append(sid, entry)

    return {
        "session_id": sid,
        "question": entry,
        "turn_count": 1,
        "interview_complete": False,
    }


@app.post("/api/interview/next")
async def next_question(req: AnswerReq):
    """
    Accept a user answer, feed the full history to the LLM,
    and return the next adaptive question.
    """
    sess = sessions.get(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if sess["complete"]:
        raise HTTPException(status_code=400, detail="Interview already complete")

    sessions.append(req.session_id, {
        "speaker": "user",
        "text": req.user_answer,
        "answer_source": req.answer_source,
    })

    result = await agents.get_next_question(sess["config"], sess["history"])
    complete = bool(result.get("interview_complete", False))

    entry = {
        "speaker": "interviewer",
        "text": result["text"],
        "question_type": result.get("question_type", "follow_up"),
        "reason": result.get("reason", ""),
    }
    sessions.append(req.session_id, entry)

    if complete:
        sessions.mark_complete(req.session_id)
        logger.info("Session %s interview complete (%d turns)",
                     req.session_id,
                     sum(1 for h in sess["history"] if h["speaker"] == "user"))

    turn_count = sum(1 for h in sess["history"] if h["speaker"] == "interviewer")

    return {
        "session_id": req.session_id,
        "question": entry,
        "turn_count": turn_count,
        "interview_complete": complete,
        "transcript": sess["history"] if complete else None,
    }


@app.get("/api/interview/{session_id}/transcript")
async def get_transcript(session_id: str):
    """Return the full interview transcript for a session."""
    sess = sessions.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session_id,
        "topic": sess["config"]["topic"],
        "target_duration": sess["config"]["target_duration"],
        "interview": sess["history"],
    }

@app.post("/api/script/generate")
async def script_generate(req: ScriptReq):
    """
    Take a completed interview session and produce a
    video-ready script at the requested duration.
    """
    sess = sessions.get(req.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    if len(sess["history"]) < 2:
        raise HTTPException(
            status_code=400,
            detail="Not enough interview data to generate a script",
        )

    logger.info("Generating %s script for session %s",
                req.target_duration, req.session_id)

    result = await agents.generate_script(
        sess["history"], req.target_duration, req.style
    )

    return {"target_duration": req.target_duration, **result}


@app.get("/api/health")
async def health():
    """
    Health check with LLM provider status.
    Returns 200 if the server is up (even if LLM isn't configured).
    """
    llm_ok = agents.check_llm_configured()
    return {
        "status": "ok" if llm_ok else "degraded",
        "llm_configured": llm_ok,
        "active_sessions": sessions.active_count(),
    }

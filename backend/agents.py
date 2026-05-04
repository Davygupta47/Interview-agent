from __future__ import annotations

import asyncio
import os
import json
import re
import logging
import time
from typing import Any

from dotenv import load_dotenv
from prompts import INTERVIEWER_SYSTEM, SCRIPT_SYSTEM

load_dotenv()

logger = logging.getLogger(__name__)
_CLIENT_TYPE: str | None = None
_CLIENT: Any = None
_INITIALIZED = False

MAX_RETRIES = 3
RETRY_DELAY_BASE = 1.0


def _init() -> None:
    global _CLIENT_TYPE, _CLIENT, _INITIALIZED

    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()

    if groq_key and groq_key != "your_groq_key_here":
        from groq import Groq
        _CLIENT_TYPE = "groq"
        _CLIENT = Groq(api_key=groq_key)
        _INITIALIZED = True
        logger.info("LLM provider: Groq (llama-3.3-70b-versatile)")
        return

    if gemini_key and gemini_key != "your_gemini_key_here":
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        _CLIENT_TYPE = "gemini"
        _CLIENT = genai
        _INITIALIZED = True
        logger.info("LLM provider: Gemini (gemini-2.5-flash-lite)")
        return

    raise RuntimeError(
        "No valid LLM key found. "
        "Set GROQ_API_KEY or GEMINI_API_KEY in backend/.env"
    )


def _ensure_client() -> None:
    if not _INITIALIZED:
        _init()


def check_llm_configured() -> bool:
    try:
        _ensure_client()
        return True
    except RuntimeError:
        return False


def _call_sync(system: str, user: str) -> str:
    _ensure_client()

    if _CLIENT_TYPE == "groq":
        res = _CLIENT.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
            temperature=0.7,
            max_tokens=600,
        )
        return res.choices[0].message.content.strip()

    model = _CLIENT.GenerativeModel(
        "gemini-2.5-flash-lite",
        generation_config={"temperature": 0.7, "max_output_tokens": 600},
    )
    res = model.generate_content(
        f"SYSTEM INSTRUCTIONS:\n{system}\n\nUSER REQUEST:\n{user}"
    )
    if not res.parts:
        raise ValueError(
            "Gemini returned empty response (likely blocked by safety filters). "
            "Try rephrasing your input."
        )
    return res.text.strip()


def _call_with_retry(system: str, user: str) -> str:
    last_error = None

    for attempt in range(MAX_RETRIES):
        try:
            return _call_sync(system, user)
        except Exception as e:
            last_error = e
            error_str = str(e).lower()

            if any(kw in error_str for kw in ["api_key", "authentication", "unauthorized", "invalid key"]):
                raise

            if "safety" in error_str or "blocked" in error_str:
                raise

            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAY_BASE * (2 ** attempt)
                logger.warning(
                    "LLM call failed (attempt %d/%d): %s — retrying in %.1fs",
                    attempt + 1, MAX_RETRIES, str(e)[:120], delay,
                )
                time.sleep(delay)

    logger.error("LLM call failed after %d attempts: %s", MAX_RETRIES, last_error)
    raise last_error  


async def _call_async(system: str, user: str) -> str:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _call_with_retry, system, user)

def _parse(raw: str) -> dict:
    clean = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()

    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    start = clean.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(clean)):
            if clean[i] == "{":
                depth += 1
            elif clean[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(clean[start:i + 1])
                    except json.JSONDecodeError:
                        break

    match = re.search(r"\{[\s\S]*\}", clean)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    logger.error("Failed to parse LLM output as JSON: %s", raw[:500])
    raise ValueError("LLM returned invalid JSON. Please try again.")


async def get_next_question(config: dict, history: list) -> dict:
    msg = (
        f"TOPIC CONFIG:\n{json.dumps(config, indent=2)}\n\n"
        f"CONVERSATION SO FAR:\n{json.dumps(history, indent=2)}\n\n"
        "Based on the conversation so far, ask the next best interview question.\n"
        "Return ONLY valid JSON."
    )
    return _parse(await _call_async(INTERVIEWER_SYSTEM, msg))


async def generate_script(transcript: list, target_duration: str, style: str) -> dict:
    msg = (
        f"TARGET DURATION: {target_duration}\n"
        f"STYLE: {style}\n\n"
        f"INTERVIEW TRANSCRIPT:\n{json.dumps(transcript, indent=2)}\n\n"
        "Generate the short video script. Return ONLY valid JSON."
    )
    return _parse(await _call_async(SCRIPT_SYSTEM, msg))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Testing LLM connection...")
    test_config = {
        "topic": "Why I avoided posting videos on LinkedIn",
        "target_audience": "founders",
        "video_goal": "Share a real fear",
        "tone": "natural, honest, conversational",
        "target_duration": "60 seconds",
    }
    result = asyncio.run(get_next_question(test_config, []))
    print(json.dumps(result, indent=2))
    print("Agent is here!!!.")

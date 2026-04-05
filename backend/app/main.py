from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 或是你 Vercel 的正式網址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
from pydantic import BaseModel
import csv
import hashlib
import os
import re
from datetime import datetime
from uuid import uuid4

from dotenv import load_dotenv
from openai import OpenAI

app = FastAPI()

# Load environment variables from .env (if present)
load_dotenv()

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

def _get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY is not set. Copy backend/.env.example to backend/.env and fill it.",
        )
    return OpenAI(api_key=api_key)

# ── System prompts per condition ──────────────────────────────────────────────
SYSTEM_PROMPTS = {
    "AI": (
        "You are a supportive AI assistant in a stress study. "
        "The participant may be feeling stressed. "
        "Respond warmly, briefly, and helpfully."
    ),
    "Writing": (
        "You are a neutral writing assistant. "
        "Help the participant express their thoughts clearly in writing. "
        "Keep responses concise."
    ),
}

# ── In-memory session store (sufficient for local study runs) ──────────────────
# NOTE: If you deploy multiple backend instances, replace with a shared store.
SESSIONS: dict[str, dict] = {}

# ── Request models ────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    session_id: str
    participant: str
    message: str
    condition: str = "AI"

class SessionStartRequest(BaseModel):
    participant: str
    condition: str


class SessionEndRequest(BaseModel):
    session_id: str

# ── Chat endpoint ─────────────────────────────────────────────────────────────
@app.post("/chat")
async def chat(req: ChatRequest):
    session = SESSIONS.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Unknown session_id")
    if session.get("ended_at") is not None:
        raise HTTPException(status_code=400, detail="Session already ended")

    if req.participant.strip() != session["participant"]:
        raise HTTPException(status_code=400, detail="Participant mismatch")
    if req.condition != session["condition"]:
        raise HTTPException(status_code=400, detail="Condition mismatch")

    message_text = req.message.strip()
    if not message_text:
        raise HTTPException(status_code=400, detail="Empty message")

    system_prompt = SYSTEM_PROMPTS.get(req.condition, SYSTEM_PROMPTS["AI"])

    # Append user message to session history
    session["messages"].append({"role": "user", "content": message_text})
    _write_log_row(
        session_id=req.session_id,
        participant=session["participant"],
        condition=session["condition"],
        event="message",
        role="user",
        message=message_text,
    )

    # Build chat history for the model (system + last N turns)
    history = session["messages"][-40:]
    client = _get_openai_client()
    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[
            {"role": "system", "content": system_prompt},
            *history,
        ],
    )

    reply = (response.choices[0].message.content or "").strip()

    session["messages"].append({"role": "assistant", "content": reply})
    _write_log_row(
        session_id=req.session_id,
        participant=session["participant"],
        condition=session["condition"],
        event="message",
        role="assistant",
        message=reply,
    )

    return {"reply": reply}

# ── Session endpoints + CSV logging (one file per participant) ───────────────
LOG_DIR = os.path.join(os.path.dirname(__file__), "..", "study_logs")
LOG_FIELDS = [
    "timestamp_utc",
    "session_id",
    "participant",
    "condition",
    "event",
    "role",
    "message",
]


def _utc_iso() -> str:
    return datetime.utcnow().isoformat()


def _participant_csv_path(participant: str) -> str:
    """One CSV per participant under study_logs/. Filename is sanitized for the OS."""
    raw = participant.strip()
    base = re.sub(r'[/\\:*?"<>|\x00-\x1f]', "_", raw)
    base = base.replace("..", "_").strip(". ")[:120]
    if not base:
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
        base = f"participant_{digest}"
    return os.path.join(LOG_DIR, f"{base}.csv")


def _write_log_row(
    *,
    session_id: str,
    participant: str,
    condition: str,
    event: str,
    role: str,
    message: str,
) -> None:
    log_path = _participant_csv_path(participant)
    os.makedirs(LOG_DIR, exist_ok=True)
    file_exists = os.path.isfile(log_path)

    with open(log_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=LOG_FIELDS)
        if not file_exists:
            writer.writeheader()
        writer.writerow(
            {
                "timestamp_utc": _utc_iso(),
                "session_id": session_id,
                "participant": participant,
                "condition": condition,
                "event": event,
                "role": role,
                "message": message,
            }
        )


@app.post("/session/start")
async def session_start(req: SessionStartRequest):
    participant = req.participant.strip()
    if not participant:
        raise HTTPException(status_code=400, detail="Missing participant")
    condition = req.condition
    if condition not in SYSTEM_PROMPTS:
        raise HTTPException(status_code=400, detail="Unknown condition")

    session_id = str(uuid4())
    SESSIONS[session_id] = {
        "participant": participant,
        "condition": condition,
        "started_at": _utc_iso(),
        "ended_at": None,
        "messages": [],
    }

    _write_log_row(
        session_id=session_id,
        participant=participant,
        condition=condition,
        event="session_start",
        role="",
        message="",
    )

    return {"session_id": session_id}


@app.post("/session/end")
async def session_end(req: SessionEndRequest):
    session = SESSIONS.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Unknown session_id")
    if session.get("ended_at") is None:
        session["ended_at"] = _utc_iso()
        _write_log_row(
            session_id=req.session_id,
            participant=session["participant"],
            condition=session["condition"],
            event="session_end",
            role="",
            message="",
        )
    return {"status": "ok"}
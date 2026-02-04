import os
import json
import shutil
import logging
from fastapi import APIRouter
from agent.manager import evict_agent
from config import SESSIONS_DIR

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/sessions")
async def list_sessions():
    results = []
    if not os.path.isdir(SESSIONS_DIR):
        return {"sessions": []}

    for entry in os.listdir(SESSIONS_DIR):
        session_json = os.path.join(SESSIONS_DIR, entry, "session.json")
        if os.path.isfile(session_json):
            with open(session_json) as f:
                data = json.load(f)
            results.append({
                "session_id": data["session_id"],
                "created_at": data["created_at"],
            })

    results.sort(key=lambda s: s["created_at"], reverse=True)
    return {"sessions": results}


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    messages_dir = os.path.join(SESSIONS_DIR, f"session_{session_id}", "agents", "agent_default", "messages")
    if not os.path.isdir(messages_dir):
        return {"messages": []}

    messages = []
    for filename in os.listdir(messages_dir):
        if filename.startswith("message_") and filename.endswith(".json"):
            with open(os.path.join(messages_dir, filename)) as f:
                data = json.load(f)
            messages.append(data)

    messages.sort(key=lambda m: m["message_id"])
    return {"messages": messages}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    session_dir = os.path.join(SESSIONS_DIR, f"session_{session_id}")

    # Evict from in-memory cache if present
    evict_agent(session_id)

    # Remove from disk
    if os.path.isdir(session_dir):
        shutil.rmtree(session_dir)
        logger.info(f"Deleted session: {session_id}")
        return {"deleted": True, "session_id": session_id}

    return {"deleted": False, "session_id": session_id, "error": "Session not found"}

from strands import Agent
from strands.types.content import SystemContentBlock
from strands.session.file_session_manager import FileSessionManager
from agent.prompts import REDLINER_PROMPT
from agent.tools import microsoft_actions_tool
from models.litellm_client import create_litellm_model
from config import SESSIONS_DIR

# In-memory agent cache: session_id -> (Agent, model_id)
_agent_cache: dict[str, tuple[Agent, str]] = {}


def get_or_create_agent(session_id: str, model_id: str) -> Agent:
    """
    Get or create an agent for the given session ID.
    If the agent exists but the model changed, swap the model in place.
    """
    if session_id in _agent_cache:
        cached_agent, cached_model_id = _agent_cache[session_id]
        if cached_model_id != model_id:
            # Swap the model in place — keeps session history intact
            cached_agent.model = create_litellm_model(model_id)
            _agent_cache[session_id] = (cached_agent, model_id)
        return cached_agent

    model = create_litellm_model(model_id)
    session_manager = FileSessionManager(
        session_id=session_id,
        storage_dir=SESSIONS_DIR,
    )
    agent = Agent(
        model=model,
        system_prompt=[
            SystemContentBlock(text=REDLINER_PROMPT),
            SystemContentBlock(cachePoint={"type": "default"}),
        ],
        tools=[microsoft_actions_tool],
        session_manager=session_manager,
    )
    _agent_cache[session_id] = (agent, model_id)
    return agent


def evict_agent(session_id: str) -> None:
    """Remove an agent from the in-memory cache."""
    if session_id in _agent_cache:
        del _agent_cache[session_id]

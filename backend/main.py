import os
import json
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from strands import Agent, tool
from strands.models.anthropic import AnthropicModel
from strands.session.file_session_manager import FileSessionManager
from agent.prompts import REDLINER_PROMPT
from agent.utils import remove_thinking_tags, convert_from_placeholders, convert_to_placeholders

load_dotenv()

# Logging — file only
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
_handler = logging.FileHandler(".logs/redliner.log")
_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s | %(message)s"))
logger.addHandler(_handler)

# FastAPI app
app = FastAPI()

# Model — stateless client wrapper, created once
model = AnthropicModel(
    client_args={"api_key": os.environ["ANTHROPIC_API_KEY"]},
    model_id="claude-sonnet-4-5-20250929",
)

# In-memory agent cache: session_id -> Agent
_agent_cache: dict[str, Agent] = {}


@tool
def microsoft_actions_tool(actions: str) -> str:
    """
    Tool for submitting Microsoft Word actions.

    Args:
        actions: JSON string containing the Microsoft actions to execute

    Returns:
        String confirming submission success.
    """
    logger.info("microsoft_actions_tool called")
    return "Action submitted successfully. It is for the user to decide whether to accept or decline your proposed change. DO NOT RESPOND FURTHER."


def get_or_create_agent(session_id: str) -> Agent:
    if session_id in _agent_cache:
        return _agent_cache[session_id]

    session_manager = FileSessionManager(
        session_id=session_id,
        storage_dir="sessions/",
    )
    agent = Agent(
        model=model,
        system_prompt=REDLINER_PROMPT,
        tools=[microsoft_actions_tool],
        session_manager=session_manager,
    )
    _agent_cache[session_id] = agent
    return agent


async def stream_agent_response(agent: Agent, user_message: str):
    """Async generator that filters Strands stream events into the four SSE types
    the frontend expects: content, tool_use, microsoft_actions, end_turn."""
    stream = agent.stream_async(user_message)

    # Track state for filtering and batching
    text_buffer = []
    TEXT_BATCH_SIZE = 3

    async for event in stream:
        logger.info("Raw stream event: %s", event)

        # --- Text chunk (Strands streaming text) ---
        if "data" in event:
            text = remove_thinking_tags(event["data"])
            text = convert_from_placeholders(text)

            # Skip empty or blank text chunks
            if text and text.strip() != "[blank text]":
                text_buffer.append(text)

                # Flush when buffer reaches batch size
                if len(text_buffer) >= TEXT_BATCH_SIZE:
                    yield {"type": "content", "data": "".join(text_buffer)}
                    text_buffer.clear()

        # --- Bedrock-style event envelope (tool_use start, messageStop) ---
        elif "event" in event:
            event_type = event["event"]

            # Tool use start - shows badge immediately
            if "contentBlockStart" in event_type:
                start = event_type["contentBlockStart"].get("start", {})
                if "toolUse" in start:
                    tool_name = start["toolUse"].get("name")
                    if tool_name:
                        # Flush text buffer before showing tool badge
                        if text_buffer:
                            yield {"type": "content", "data": "".join(text_buffer)}
                            text_buffer.clear()

                        yield {
                            "type": "tool_use",
                            "tool_name": tool_name
                        }

            # End turn
            elif "messageStop" in event_type:
                if event_type["messageStop"].get("stopReason") == "end_turn":
                    # Flush remaining text
                    if text_buffer:
                        yield {"type": "content", "data": "".join(text_buffer)}
                        text_buffer.clear()

                    yield {"type": "end_turn"}

        # --- Complete message (contains tool invocations) ---
        elif "message" in event:
            # Flush remaining text first
            if text_buffer:
                yield {"type": "content", "data": "".join(text_buffer)}
                text_buffer.clear()

            message = event["message"]
            if message.get("role") == "assistant":
                for item in message.get("content", []):
                    if "toolUse" in item:
                        tool_use = item["toolUse"]
                        tool_name = tool_use.get("name")

                        if tool_name == "microsoft_actions_tool":
                            try:
                                actions = json.loads(tool_use["input"]["actions"])

                                # Convert placeholders in new_text fields
                                for action in actions:
                                    if "new_text" in action:
                                        action["new_text"] = convert_from_placeholders(action["new_text"])

                                yield {
                                    "type": "microsoft_actions",
                                    "actions": actions
                                }
                            except Exception as e:
                                logger.error("Failed to parse microsoft_actions: %s", str(e))


@app.post("/invoke")
async def invoke(request: Request):
    body = await request.json()
    session_id = request.headers.get("x-session-id", "default")

    user_input = body.get("prompt", "")
    word_document = body.get("word_document", "")
    highlighted = body.get("highlighted", "")

    logger.info("Session: %s | Prompt length: %d | Document length: %d",
                session_id, len(user_input), len(word_document))

    # Convert problematic characters to placeholders before sending to LLM
    word_document = convert_to_placeholders(word_document)
    highlighted = convert_to_placeholders(highlighted)
    highlighted_section = f"<highlighted>{highlighted}</highlighted>" if highlighted else ""

    user_message = f"<word_document>{word_document}</word_document>\n{highlighted_section}\n<user_input>{user_input}</user_input>"

    agent = get_or_create_agent(session_id)

    async def sse_stream():
        async for event in stream_agent_response(agent, user_message):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        sse_stream(),
        media_type="text/event-stream",
    )

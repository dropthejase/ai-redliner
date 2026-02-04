import json
import logging
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from agent.manager import get_or_create_agent
from agent.utils import remove_thinking_tags, convert_from_placeholders, convert_to_placeholders, mock_stream
from models.model_catalog import get_allowed_models
from config import DEFAULT_MODEL_ID, MOCK_MODE

logger = logging.getLogger(__name__)
router = APIRouter()


async def stream_agent_response(agent, user_message: str):
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


@router.post("/invoke")
async def invoke(request: Request):
    body = await request.json()
    session_id = request.headers.get("x-session-id", "default")

    user_input = body.get("prompt", "")
    word_document = body.get("word_document", "")
    highlighted = body.get("highlighted", "")
    model_id = body.get("model", DEFAULT_MODEL_ID)

    # Validate model ID against proxy catalog or fallback list
    allowed_models = await get_allowed_models()
    if model_id not in allowed_models:
        logger.warning(f"Invalid model_id '{model_id}', falling back to {DEFAULT_MODEL_ID}")
        model_id = DEFAULT_MODEL_ID

    logger.info("Session: %s | Model: %s | Prompt length: %d | Document length: %d",
                session_id, model_id, len(user_input), len(word_document))

    if MOCK_MODE:
        logger.info("MOCK MODE — returning hardcoded response")

        async def mock_sse():
            async for event in mock_stream(word_document, model_id):
                yield f"data: {json.dumps(event)}\n\n"

        return StreamingResponse(mock_sse(), media_type="text/event-stream")

    # Convert problematic characters to placeholders before sending to LLM
    word_document = convert_to_placeholders(word_document)
    highlighted = convert_to_placeholders(highlighted)

    # nosemgrep: python.django.security.injection.raw-html-format.raw-html-format
    highlighted_section = f"<highlighted>{highlighted}</highlighted>" if highlighted else ""

    # nosemgrep: python.django.security.injection.raw-html-format.raw-html-format
    user_message = f"<word_document>{word_document}</word_document>\n{highlighted_section}\n<user_input>{user_input}</user_input>"

    agent = get_or_create_agent(session_id, model_id)

    async def sse_stream():
        async for event in stream_agent_response(agent, user_message):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        sse_stream(),
        media_type="text/event-stream",
    )

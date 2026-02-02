"""
Utility functions to use in agent/main.py
"""

# Character mapping for problematic characters that may get normalised by LLM
CHAR_PLACEHOLDERS = {
    '\r': '[u+000D]',      # Carriage return \r
    '\u201C': '[u+201C]',  # Left double quote
    '\u201D': '[u+201D]',  # Right double quote
    '\u2018': '[u+2018]',  # Left single quote
    '\u2019': '[u+2019]',  # Right single quote
    '\u2013': '[u+2013]',  # En dash
    '\u2014': '[u+2014]',  # Em dash
    '\u2026': '[u+2026]',  # Ellipsis
}


def convert_to_placeholders(text: str) -> str:
    """Convert problematic characters to placeholders for LLM processing"""
    if not text:
        return ''
    for char, placeholder in CHAR_PLACEHOLDERS.items():
        text = text.replace(char, placeholder)
    return text


def convert_from_placeholders(text: str) -> str:
    """Convert placeholders back to original characters"""
    for char, placeholder in CHAR_PLACEHOLDERS.items():
        text = text.replace(placeholder, char)
    return text


def remove_thinking_tags(response_str):
    """Remove <thinking> tags and content from agent responses"""
    if "<thinking>" in response_str and "</thinking>" in response_str:
        thinking_start = response_str.find("<thinking>")
        thinking_end = response_str.find("</thinking>") + len("</thinking>")
        return response_str[:thinking_start] + response_str[thinking_end:]
    return response_str


async def mock_stream(word_document: str, model_id: str = "unknown"):
    """Hardcoded SSE sequence for local frontend testing. No API key required.
    Exercises every microsoft_action type once."""
    import asyncio

    # 1. Conversational text (streamed in chunks to simulate batching)
    yield {"type": "content", "data": f"This is {model_id}. "}
    await asyncio.sleep(0.3)
    yield {"type": "content", "data": "Sure! Here's "}
    await asyncio.sleep(0.3)
    yield {"type": "content", "data": "a demo of every action type."}
    await asyncio.sleep(0.3)

    # 2. Tool badge
    yield {"type": "tool_use", "tool_name": "microsoft_actions_tool"}
    await asyncio.sleep(0.4)

    # 3. One of each action type
    yield {
        "type": "microsoft_actions",
        "actions": [
            {
                "task": "Rename recipe title",
                "action": "replace",
                "loc": "p0",
                "new_text": "Cookies",
            },
            {
                "task": "Append to abstract",
                "action": "append",
                "loc": "p2",
                "new_text": " A classic homemade recipe.",
            },
            {
                "task": "Prepend to ingredients",
                "action": "prepend",
                "loc": "p4",
                "new_text": "You will need: ",
            },
            {
                "task": "Delete steps placeholder",
                "action": "delete",
                "loc": "p6",
            },
            {
                "task": "Highlight the abstract heading",
                "action": "highlight",
                "loc": "p1",
            },
            {
                "task": "Bold the ingredients heading",
                "action": "format_bold",
                "loc": "p3",
            },
            {
                "task": "Italicise the steps heading",
                "action": "format_italic",
                "loc": "p5",
            },
            {
                "task": "Strikethrough the abstract placeholder",
                "action": "strikethrough",
                "loc": "p2",
            },
        ],
    }
    await asyncio.sleep(0.3)

    # 4. End turn
    yield {"type": "end_turn"}

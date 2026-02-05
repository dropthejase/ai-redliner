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
    Tests crucial operations: paragraph edits, table cell edits, row operations, and within-paragraph targeting.

    Expected test document:
    0.p0: The fox says [speech].
    1.t0.r0.c0.p0: This is row 0 column 0 paragraph 0 with [test] placeholder and another [test] placeholder to test occurrence.
    2.t0.r0.c0.p1: This is row 0 column 0 paragraph 1.
    3.t0.r0.c1.p0: This is row 0 column 1 paragraph 0.
    4.t0.r1.c0.p0: Try deleting this entire row!
    5.t0.r1.c1.p0:
    6.t0.r2.c0.p0: Try inserting a row after me
    7.t0.r2.c1.p0:
    8.p8: The rabbit [action].
    9.p9: The squirrel [action]. Insert a table after this line.
    10.t1.r0.c0.p0: Delete
    11.t1.r0.c1.p0: this
    12.t1.r0.c2.p0: entire
    13.t1.r1.c0.p0: table
    14.t1.r1.c1.p0:
    15.t1.r1.c2.p0:
    16.p16: Errors aren't propagated to frontend.
    """
    import asyncio

    # 1. Conversational text (streamed in chunks to simulate batching)
    yield {"type": "content", "data": f"This is {model_id}. "}
    await asyncio.sleep(0.3)
    yield {"type": "content", "data": "I'll demonstrate the key operations: "}
    await asyncio.sleep(0.3)
    yield {"type": "content", "data": "paragraph edits, table cell edits, row operations, table operations, and within-paragraph targeting."}
    await asyncio.sleep(0.3)

    # 2. Tool badge
    yield {"type": "tool_use", "tool_name": "microsoft_actions_tool"}
    await asyncio.sleep(0.4)

    # 3. Crucial action set
    yield {
        "type": "microsoft_actions",
        "actions": [
            # 1. Paragraph-level edit
            {
                "task": "Replace paragraph text",
                "action": "replace",
                "loc": "0.p0",
                "new_text": "The fox says hello.",
            },
            # 2. Within-paragraph edit (first occurrence of [test])
            {
                "task": "Replace first [test] placeholder",
                "action": "replace",
                "loc": "1.t0.r0.c0.p0",
                "new_text": "TEST1",
                "withinPara": {
                    "find": "[test]",
                    "occurrence": 0,
                },
            },
            # 3. Within-paragraph edit (second occurrence of [test])
            {
                "task": "Replace second [test] placeholder",
                "action": "replace",
                "loc": "1.t0.r0.c0.p0",
                "new_text": "TEST2",
                "withinPara": {
                    "find": "[test]",
                    "occurrence": 1,
                },
            },
            # 4. Table cell edit (full paragraph)
            {
                "task": "Replace table cell paragraph",
                "action": "replace",
                "loc": "3.t0.r0.c1.p0",
                "new_text": "This cell has been updated.",
            },
            # 5. Row-level operation: delete row 1
            {
                "task": "Delete row 1",
                "action": "delete_row",
                "loc": "4.t0.r1",
            },
            # 6. Row-level operation: insert after row 2 (which becomes row 1 after deletion)
            {
                "task": "Insert new row after row 2",
                "action": "insert_row",
                "loc": "6.t0.r2",
                "rowData": [["Inserted cell 1", "Inserted cell 2"]],
            },
            # 7. Within-paragraph edit in regular paragraph
            {
                "task": "Replace [action] placeholder",
                "action": "replace",
                "loc": "8.p8",
                "new_text": "hops",
                "withinPara": {
                    "find": "[action]",
                    "occurrence": 0,
                },
            },
            # 8. Create table after p9
            {
                "task": "Create pricing table after p9",
                "action": "create_table",
                "loc": "9.p9",
                "rowCount": 3,
                "columnCount": 2,
                "values": [
                    ["Product", "Price"],
                    ["Widget A", "$10"],
                    ["Widget B", "$20"]
                ],
            },
            # 9. Delete entire table t1
            {
                "task": "Delete entire table t1",
                "action": "delete_table",
                "loc": "10.t1",
            },
            # 10. Error testing
            {
                "task": "Error testing",
                "action": "delete",
                "loc": "99.p99",
            },
        ],
    }
    await asyncio.sleep(0.3)

    # 4. End turn
    yield {"type": "end_turn"}

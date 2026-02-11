from ddgs import DDGS
from strands import tool

import json


@tool
def fetch(search_string: str) -> str:
    results = DDGS().text(search_string, max_results=5)
    return json.dumps(results)
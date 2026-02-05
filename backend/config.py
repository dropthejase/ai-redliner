import os
from dotenv import load_dotenv

load_dotenv()

# API Configuration
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# LiteLLM Proxy Configuration
LITELLM_PROXY_URL = os.environ.get("LITELLM_PROXY_URL", "http://127.0.0.1:4000")
LITELLM_MASTER_KEY = os.environ.get("LITELLM_MASTER_KEY", "")

# Model Configuration
DEFAULT_MODEL_ID = os.environ.get("DEFAULT_MODEL_ID", "anthropic/claude-haiku-4-5")

# Model IDs will be validated dynamically against proxy catalog
# Keep this as fallback when proxy is unavailable
FALLBACK_MODEL_IDS = {
    "anthropic/claude-haiku-4-5",
    "anthropic/claude-sonnet-4-5",
    "anthropic/claude-opus-4-5",
}

# Mock Mode
MOCK_MODE = os.environ.get("MOCK", "").strip() == "1"

# Session Storage
SESSIONS_DIR = "sessions/"

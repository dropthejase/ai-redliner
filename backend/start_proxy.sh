#!/bin/bash
# Start LiteLLM proxy server with config

set -e

# Change to backend directory to ensure correct project context
cd "$(dirname "$0")"

# Sync core dependencies from pyproject.toml
echo "📦 Syncing core dependencies..."
uv sync

# Install litellm proxy dependencies (backoff is the main one needed)
# Don't reinstall litellm itself to avoid conflicts with strands-agents[litellm]
echo "🔧 Installing LiteLLM proxy dependencies..."
uv pip install backoff

# Verify critical proxy dependencies
REQUIRED_DEPS=("litellm" "backoff")
MISSING=()

for dep in "${REQUIRED_DEPS[@]}"; do
    if ! uv pip show "$dep" &> /dev/null 2>&1; then
        MISSING+=("$dep")
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "❌ Missing critical dependencies: ${MISSING[*]}"
    echo "💡 Try running manually: uv pip install 'litellm[proxy]'"
    exit 1
fi

echo "✅ Dependencies verified"

# Load .env file if it exists
if [ -f .env ]; then
    echo "✅ Loading environment variables from .env"
    set -a
    source .env
    set +a
fi

# Check for required API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY not set in .env"
    echo "   The proxy will not be able to route to Anthropic models."
fi

echo "🚀 Starting LiteLLM proxy on http://127.0.0.1:4000"
echo "   Config: litellm_config.yaml"
echo ""

# Start the proxy using uv run (ensures correct venv)
uv run --with 'litellm[proxy]' litellm --config litellm_config.yaml --host 127.0.0.1 --port 4000 --debug #--detailed_debug

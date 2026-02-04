#!/bin/bash
# Start LiteLLM proxy server with config

set -e

# Check if litellm is installed with uv
if ! uv pip show litellm &> /dev/null; then
    echo "❌ litellm not found. Installing..."
    uv pip install 'litellm[proxy]'
fi

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

# Start the proxy using uv
uv run litellm --config litellm_config.yaml --host 127.0.0.1 --port 4000 --debug #--detailed_debug

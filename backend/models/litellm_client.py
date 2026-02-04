from strands.models.litellm import LiteLLMModel
from config import LITELLM_PROXY_URL, LITELLM_MASTER_KEY


def create_litellm_model(model_id: str) -> LiteLLMModel:
    """Create a LiteLLM model using the proxy."""
    return LiteLLMModel(
        client_args={
            "api_key": LITELLM_MASTER_KEY or "dummy-key",
            "api_base": LITELLM_PROXY_URL,
        },
        model_id=model_id,
        params={"max_tokens": 8192},
    )

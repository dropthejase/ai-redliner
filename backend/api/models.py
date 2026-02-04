import logging
from fastapi import APIRouter
from config import LITELLM_PROXY_URL, LITELLM_MASTER_KEY

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/models")
async def list_models():
    """
    Fetch available models from LiteLLM proxy or return static list.
    Frontend uses this to populate the model picker dynamically.
    """
    if LITELLM_PROXY_URL:
        try:
            import httpx
            headers = {"Authorization": f"Bearer {LITELLM_MASTER_KEY}"} if LITELLM_MASTER_KEY else {}

            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{LITELLM_PROXY_URL}/model/info", headers=headers, timeout=5.0)
                resp.raise_for_status()
                data = resp.json()

                # Transform proxy response to frontend format
                models = []
                for model_info in data.get("data", []):
                    model_id = model_info["model_name"]

                    # Generate friendly label and description
                    label = model_id.replace("-", " ").replace("_", " ").title()
                    description = ""

                    # Add descriptions for known models
                    if "haiku" in model_id.lower():
                        description = "Fastest, most affordable"
                    elif "sonnet" in model_id.lower():
                        description = "Balanced speed and quality"
                    elif "opus" in model_id.lower():
                        description = "Most capable, slowest"
                    elif "gpt-4o-mini" in model_id.lower():
                        description = "Fast and affordable OpenAI model"
                    elif "gpt-4o" in model_id.lower():
                        description = "OpenAI's most capable model"
                    elif "gemini" in model_id.lower():
                        description = "Google's multimodal model"

                    models.append({
                        "id": model_id,
                        "label": label,
                        "description": description,
                    })

                logger.info(f"Served {len(models)} models from proxy")
                return {"models": models}
        except Exception as e:
            logger.error(f"Failed to fetch models from proxy: {e}")
            # Fall through to static list

    # Fallback: static list when proxy is unavailable
    return {
        "models": [
            {"id": "claude-haiku-4-5", "label": "Claude Haiku 4.5", "description": "Fastest, most affordable"},
            {"id": "claude-sonnet-4-5", "label": "Claude Sonnet 4.5", "description": "Balanced speed and quality"},
            {"id": "claude-opus-4-5", "label": "Claude Opus 4.5", "description": "Most capable, slowest"},
        ]
    }

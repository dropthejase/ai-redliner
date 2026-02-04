import logging
from config import LITELLM_PROXY_URL, LITELLM_MASTER_KEY, FALLBACK_MODEL_IDS

logger = logging.getLogger(__name__)


async def get_allowed_models() -> set[str]:
    """
    Fetch allowed model IDs from LiteLLM proxy or return fallback set.
    Used for validating user-submitted model IDs.
    """
    if LITELLM_PROXY_URL:
        try:
            import httpx
            headers = {"Authorization": f"Bearer {LITELLM_MASTER_KEY}"} if LITELLM_MASTER_KEY else {}

            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{LITELLM_PROXY_URL}/model/info", headers=headers, timeout=5.0)
                resp.raise_for_status()
                data = resp.json()
                model_ids = {m["model_name"] for m in data.get("data", [])}
                logger.info(f"Fetched {len(model_ids)} models from proxy")
                return model_ids
        except Exception as e:
            logger.warning(f"Failed to fetch models from proxy: {e}, using fallback")

    return FALLBACK_MODEL_IDS

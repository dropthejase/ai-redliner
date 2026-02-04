import logging
from strands import tool

logger = logging.getLogger(__name__)


@tool
def microsoft_actions_tool(actions: str) -> str:
    """
    Tool for submitting Microsoft Word actions.

    Args:
        actions: JSON string containing the Microsoft actions to execute

    Returns:
        String confirming submission success.
    """
    logger.info("microsoft_actions_tool called")
    return "Action submitted successfully. It is for the user to decide whether to accept or decline your proposed change. DO NOT RESPOND FURTHER."

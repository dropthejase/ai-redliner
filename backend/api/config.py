import logging
import os
import platform
import subprocess
from pathlib import Path
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/config/open-folder")
async def open_config_folder():
    """Open the config folder in the system file explorer."""
    config_path = Path(__file__).parent.parent.parent / "config"

    if not config_path.exists():
        raise HTTPException(status_code=404, detail="Config folder not found")

    config_path = config_path.resolve()

    try:
        system = platform.system()
        if system == "Darwin":  # macOS
            subprocess.run(["open", str(config_path)], check=True)
        elif system == "Windows":
            subprocess.run(["explorer", str(config_path)], check=True)
        elif system == "Linux":
            subprocess.run(["xdg-open", str(config_path)], check=True)
        else:
            raise HTTPException(status_code=500, detail=f"Unsupported platform: {system}")

        logger.info("Opened config folder: %s", config_path)
        return {"status": "success", "path": str(config_path)}

    except Exception as e:
        logger.error("Failed to open config folder: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config/mcp-servers")
async def get_mcp_servers():
    """Get the list of configured MCP servers from mcp.json."""
    config_path = Path(__file__).parent.parent.parent / "config" / "mcp.json"

    if not config_path.exists():
        return {"servers": []}

    try:
        import json
        with open(config_path, "r") as f:
            config = json.load(f)

        servers = []
        for name, server_config in config.get("mcpServers", {}).items():
            servers.append({
                "name": name,
                "command": server_config.get("command"),
                "args": server_config.get("args", []),
                "has_env": bool(server_config.get("env")),
                "enabled": server_config.get("enabled", True)
            })

        return {"servers": servers}

    except Exception as e:
        logger.error("Failed to read mcp.json: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config/mcp-servers/reload")
async def reload_mcp_servers():
    """
    Reload MCP servers from mcp.json without restarting the backend.
    Clears agent cache so new sessions get updated tools.
    """
    try:
        from agent.manager import reload_mcp_tools
        reload_mcp_tools()
        logger.info("MCP servers reloaded successfully")
        return {"status": "success", "message": "MCP servers reloaded"}
    except Exception as e:
        logger.error("Failed to reload MCP servers: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))

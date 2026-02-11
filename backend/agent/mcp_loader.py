import json
import logging
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)


def load_mcp_clients() -> List:
    """
    Load MCP clients from config/mcp.json.
    Returns a list of MCPClient instances (or empty list if no config or errors).
    """
    config_path = Path(__file__).parent.parent.parent / "config" / "mcp.json"
    logger.info("Loading MCP clients from: %s", config_path)

    if not config_path.exists():
        logger.warning("No mcp.json found at %s — skipping MCP servers", config_path)
        return []

    try:
        with open(config_path, "r") as f:
            config = json.load(f)

        mcp_servers = config.get("mcpServers", {})
        logger.info("Found %d MCP server(s) in config", len(mcp_servers))

        if not mcp_servers:
            logger.info("No MCP servers configured in mcp.json")
            return []

        # Import MCP dependencies only if we have servers configured
        try:
            from mcp import stdio_client, StdioServerParameters
            from strands.tools.mcp import MCPClient
            logger.info("MCP dependencies imported successfully")
        except ImportError as e:
            logger.error("Failed to import MCP dependencies: %s. Run 'uv add mcp' to install.", str(e))
            return []

        clients = []
        for server_name, server_config in mcp_servers.items():
            try:
                # Skip disabled servers (default to enabled if not specified)
                enabled = server_config.get("enabled", True)
                if not enabled:
                    logger.info("Skipping disabled MCP server: %s", server_name)
                    continue

                command = server_config["command"]
                args = server_config.get("args", [])
                env = server_config.get("env", None)

                # Create MCPClient with stdio connection
                mcp_client = MCPClient(
                    lambda cmd=command, a=args, e=env: stdio_client(
                        StdioServerParameters(
                            command=cmd,
                            args=a,
                            env=e
                        )
                    )
                )

                clients.append(mcp_client)
                logger.info("Loaded MCP server: %s (command: %s)", server_name, command)

            except Exception as e:
                logger.error("Failed to load MCP server '%s': %s", server_name, str(e))
                continue

        logger.info("Successfully loaded %d MCP client(s)", len(clients))
        return clients

    except Exception as e:
        logger.error("Failed to load mcp.json: %s", str(e), exc_info=True)
        return []

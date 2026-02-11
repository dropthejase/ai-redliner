# Redliner Configuration

## MCP Servers

`mcp.json` defines Model Context Protocol (MCP) servers that extend the agent's capabilities.

### Configuration Format

```json
{
  "mcpServers": {
    "server-name": {
      "command": "uvx",
      "args": ["package-name", "...args"],
      "enabled": true,
      "env": {
        "API_KEY": "your-key-here"
      }
    }
  }
}
```

- **`enabled`** (optional): Set to `false` to disable a server without removing it. Defaults to `true` if not specified.

### Example Servers

**AWS Knowledge Base:**
```json
{
  "mcpServers": {
    "aws-knowledge-mcp-server": {
      "command": "uvx",
      "args": ["fastmcp", "run", "https://knowledge-mcp.global.api.aws"],
      "enabled": true
    }
  }
}
```

**Filesystem Access:**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"],
      "enabled": true
    }
  }
}
```

**Web Search (Brave):**
```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "enabled": true,
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key"
      }
    }
  }
}
```

### Usage

1. Copy `mcp.example.json` to `mcp.json`
2. Add your MCP server configurations
3. Restart the backend server
4. MCP tools will be available to the agent

**Note:** `mcp.json` is gitignored to protect API keys.

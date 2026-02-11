import * as React from "react";
import { cn } from "../lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { AlertCircle, FolderOpen, Server, RefreshCw } from "lucide-react";

export interface ModelOption {
  id: string;
  label: string;
}

export type ModelId = string;

export const DEFAULT_MODEL_ID = "anthropic/claude-haiku-4-5";
const STORAGE_KEY = "redliner:model";
const AUTO_APPROVE_KEY = "redliner:autoApproveTools";

export function getStoredModel(): ModelId {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored || DEFAULT_MODEL_ID;
}

export function setStoredModel(id: ModelId) {
  localStorage.setItem(STORAGE_KEY, id);
}

export function getAutoApproveTools(): boolean {
  const stored = localStorage.getItem(AUTO_APPROVE_KEY);
  return stored === "true";
}

export function setAutoApproveTools(value: boolean) {
  localStorage.setItem(AUTO_APPROVE_KEY, String(value));
}

interface McpServer {
  name: string;
  command: string;
  args: string[];
  has_env: boolean;
  enabled: boolean;
}

interface SettingsProps {
  selectedModel: ModelId;
  onModelChange: (id: ModelId) => void;
}

const Settings: React.FC<SettingsProps> = ({ selectedModel, onModelChange }) => {
  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [autoApprove, setAutoApprove] = React.useState(getAutoApproveTools());
  const [mcpServers, setMcpServers] = React.useState<McpServer[]>([]);
  const [mcpLoading, setMcpLoading] = React.useState(false);
  const [reloading, setReloading] = React.useState(false);

  const handleAutoApproveChange = (checked: boolean) => {
    setAutoApprove(checked);
    setAutoApproveTools(checked);
  };

  React.useEffect(() => {
    // Fetch models
    fetch("https://localhost:8000/models")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setModels(data.models);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch models:", err);
        setError("Could not load models from backend");
        setLoading(false);
      });

    // Fetch MCP servers
    fetchMcpServers();
  }, []);

  const fetchMcpServers = () => {
    setMcpLoading(true);
    fetch("https://localhost:8000/config/mcp-servers")
      .then((res) => res.json())
      .then((data) => {
        setMcpServers(data.servers || []);
        setMcpLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch MCP servers:", err);
        setMcpLoading(false);
      });
  };

  const handleOpenConfigFolder = async () => {
    try {
      const response = await fetch("https://localhost:8000/config/open-folder", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Failed to open folder: ${response.status}`);
      }
    } catch (err) {
      console.error("Failed to open config folder:", err);
      alert("Failed to open config folder. Check console for details.");
    }
  };

  const handleReloadMcpServers = async () => {
    setReloading(true);
    try {
      const response = await fetch("https://localhost:8000/config/mcp-servers/reload", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Failed to reload: ${response.status}`);
      }
      // Refresh the server list
      await fetchMcpServers();
    } catch (err) {
      console.error("Failed to reload MCP servers:", err);
      alert("Failed to reload MCP servers. Check console for details.");
    } finally {
      setReloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading models...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Model</h2>
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Tool Permissions</h2>
          <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
            <div className="flex-1 pr-4">
              <div className="text-sm font-medium text-foreground mb-1">
                Auto-approve tool actions
              </div>
              <div className="text-xs text-muted-foreground">
                Automatically approve file reads, shell commands, and code execution
              </div>
            </div>
            <Switch
              checked={autoApprove}
              onCheckedChange={handleAutoApproveChange}
            />
          </div>
          {!autoApprove && (
            <div className="mt-3 flex items-start gap-2 p-3 border border-amber-200 bg-amber-50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                You'll need to approve tool actions via the FastAPI server terminal
              </p>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">MCP Servers</h2>

          {mcpServers.length > 0 ? (
            <div className="space-y-2 mb-3">
              {mcpServers.map((server) => (
                <div key={server.name} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card">
                  <Server className={cn(
                    "h-4 w-4 flex-shrink-0",
                    server.enabled ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-sm font-medium",
                      server.enabled ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {server.name}
                    </div>
                  </div>
                  <div className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    server.enabled
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  )}>
                    {server.enabled ? "Enabled" : "Disabled"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground mb-3 border border-border rounded-lg bg-card">
              {mcpLoading ? "Loading..." : "No MCP servers configured"}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleOpenConfigFolder}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors border border-primary/20"
            >
              <FolderOpen className="h-4 w-4" />
              Open Config Folder
            </button>
            <button
              onClick={handleReloadMcpServers}
              disabled={reloading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={cn("h-4 w-4", reloading && "animate-spin")} />
              {reloading ? "Reloading..." : "Reload Servers"}
            </button>
          </div>

          <div className="mt-3 px-3 py-2 text-xs text-muted-foreground border border-border rounded-lg bg-card">
            Edit <code className="px-1 py-0.5 bg-muted rounded">mcp.json</code> to add or modify MCP servers.
            See <code className="px-1 py-0.5 bg-muted rounded">mcp.example.json</code> for examples.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

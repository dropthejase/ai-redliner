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
import { AlertCircle } from "lucide-react";

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

interface SettingsProps {
  selectedModel: ModelId;
  onModelChange: (id: ModelId) => void;
}

const Settings: React.FC<SettingsProps> = ({ selectedModel, onModelChange }) => {
  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [autoApprove, setAutoApprove] = React.useState(getAutoApproveTools());

  const handleAutoApproveChange = (checked: boolean) => {
    setAutoApprove(checked);
    setAutoApproveTools(checked);
  };

  React.useEffect(() => {
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
  }, []);

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
          <div className="px-3 py-2 text-sm text-muted-foreground italic border border-border rounded-lg bg-card">
            Coming soon
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

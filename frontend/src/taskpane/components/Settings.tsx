import * as React from "react";
import { cn } from "../lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export interface ModelOption {
  id: string;
  label: string;
}

export type ModelId = string;

export const DEFAULT_MODEL_ID = "anthropic/claude-haiku-4-5";
const STORAGE_KEY = "redliner:model";

export function getStoredModel(): ModelId {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored || DEFAULT_MODEL_ID;
}

export function setStoredModel(id: ModelId) {
  localStorage.setItem(STORAGE_KEY, id);
}

interface SettingsProps {
  selectedModel: ModelId;
  onModelChange: (id: ModelId) => void;
}

const Settings: React.FC<SettingsProps> = ({ selectedModel, onModelChange }) => {
  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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

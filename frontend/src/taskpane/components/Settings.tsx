import * as React from "react";
import { cn } from "../lib/utils";

export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export type ModelId = string;

export const DEFAULT_MODEL_ID = "claude-haiku-4-5";
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
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Model</h2>
          <div className="flex flex-col gap-2">
            {models.map((model) => {
              const isSelected = selectedModel === model.id;
              return (
                <button
                  key={model.id}
                  onClick={() => onModelChange(model.id)}
                  className={cn(
                    "text-left w-full px-3 py-2.5 rounded-lg border transition-colors",
                    isSelected
                      ? "border-primary bg-accent"
                      : "border-border bg-card hover:bg-card-foreground/5"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-sm font-medium", isSelected ? "text-accent-foreground" : "text-foreground")}>
                      {model.label}
                    </span>
                    {isSelected && (
                      <span className="text-xs text-accent-foreground font-medium">Selected</span>
                    )}
                  </div>
                  <p className={cn("text-xs mt-0.5", isSelected ? "text-accent-foreground/70" : "text-muted-foreground")}>
                    {model.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

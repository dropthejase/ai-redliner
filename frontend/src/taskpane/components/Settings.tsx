import * as React from "react";
import { cn } from "../lib/utils";

export const MODEL_OPTIONS = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", description: "Fastest, most affordable" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", description: "Balanced speed and quality" },
  { id: "claude-opus-4-5", label: "Claude Opus 4.5", description: "Most capable, slowest" },
] as const;

export type ModelId = typeof MODEL_OPTIONS[number]["id"];

export const DEFAULT_MODEL_ID: ModelId = "claude-haiku-4-5";
const STORAGE_KEY = "redliner:model";

export function getStoredModel(): ModelId {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && MODEL_OPTIONS.some((m) => m.id === stored)) {
    return stored as ModelId;
  }
  return DEFAULT_MODEL_ID;
}

export function setStoredModel(id: ModelId) {
  localStorage.setItem(STORAGE_KEY, id);
}

interface SettingsProps {
  selectedModel: ModelId;
  onModelChange: (id: ModelId) => void;
}

const Settings: React.FC<SettingsProps> = ({ selectedModel, onModelChange }) => {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Model</h2>
          <div className="flex flex-col gap-2">
            {MODEL_OPTIONS.map((model) => {
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

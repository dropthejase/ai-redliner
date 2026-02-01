/* global Word */
import * as React from "react";
import { ChevronRight, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { executeWordAction, getWordDocumentContent, isDocumentEmpty } from "../taskpane";

interface Action {
  task: string;
  action: string;
  loc: string;
  new_text?: string;
}

interface ModificationReviewProps {
  modifications: Action[];
  onApply: (appliedIndices: number[], rejectedIndices: number[]) => void;
  disabled: boolean;
  appliedIndices?: number[];
  rejectedIndices?: number[];
  documentHashWhenSent?: string | null;
  onHashMismatch?: () => void;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

function formatAction(action: string): string {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

async function navigateToParagraph(loc: string) {
  try {
    await Word.run(async (context: Word.RequestContext) => {
      const match = loc.match(/^p(\d+)$/);
      if (!match) return;

      const paragraphIndex = parseInt(match[1]);
      const paragraphs = context.document.body.paragraphs;
      paragraphs.load("items");
      await context.sync();

      if (paragraphIndex < 0 || paragraphIndex >= paragraphs.items.length) return;

      const paragraph = paragraphs.items[paragraphIndex];
      const range = paragraph.getRange("Content");
      range.select();
      await context.sync();
    });
  } catch (error) {
    console.error(`Error navigating to paragraph ${loc}:`, error);
  }
}

const ModificationReview: React.FC<ModificationReviewProps> = ({
  modifications,
  onApply,
  disabled,
  appliedIndices = [],
  rejectedIndices = [],
  documentHashWhenSent,
  onHashMismatch,
}) => {
  const [expanded, setExpanded] = React.useState(!disabled);
  const [selectedMods, setSelectedMods] = React.useState<number[]>(
    modifications.map((_, i) => i)
  );
  const [expandedMods, setExpandedMods] = React.useState<number[]>([]);
  const [errors, setErrors] = React.useState<Record<number, string>>({});
  const [successes, setSuccesses] = React.useState<Record<number, boolean>>({});

  React.useEffect(() => {
    if (disabled) setExpanded(false);
  }, [disabled]);

  const handleToggle = (index: number) => {
    setSelectedMods((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleToggleAll = () => {
    if (selectedMods.length === modifications.length) {
      setSelectedMods([]);
    } else {
      setSelectedMods(modifications.map((_, i) => i));
    }
  };

  const handleExpandMod = (index: number) => {
    setExpandedMods((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
    if (!expandedMods.includes(index) && modifications[index].loc) {
      navigateToParagraph(modifications[index].loc);
    }
  };

  const handleApply = async () => {
    if (documentHashWhenSent) {
      const isEmpty = await isDocumentEmpty();
      const currentDoc = isEmpty ? "" : await getWordDocumentContent();
      const currentHash = simpleHash(currentDoc);

      if (currentHash !== documentHashWhenSent) {
        if (onHashMismatch) onHashMismatch();
        setExpanded(false);
        onApply([], modifications.map((_, i) => i));
        return;
      }
    }

    const modsToApply = modifications
      .map((mod, i) => ({ ...mod, originalIndex: i }))
      .filter((mod) => selectedMods.includes(mod.originalIndex))
      .sort((a, b) => {
        const aNum = parseInt(a.loc?.match(/^p(\d+)$/)?.[1] || "0");
        const bNum = parseInt(b.loc?.match(/^p(\d+)$/)?.[1] || "0");
        return bNum - aNum;
      });

    const newErrors: Record<number, string> = {};
    const newSuccesses: Record<number, boolean> = {};

    for (const mod of modsToApply) {
      try {
        await executeWordAction([mod]);
        newSuccesses[mod.originalIndex] = true;
      } catch (error) {
        newErrors[mod.originalIndex] = error instanceof Error ? error.message : "Unknown error";
      }
    }

    setErrors(newErrors);
    setSuccesses(newSuccesses);

    const applied = selectedMods;
    const rejected = modifications.map((_, i) => i).filter((i) => !selectedMods.includes(i));

    setExpanded(false);
    onApply(applied, rejected);
  };

  const hasErrors = Object.keys(errors).length > 0;

  const getStatus = (i: number): "applied" | "rejected" | "error" | "pending" => {
    if (errors[i]) return "error";
    if (successes[i]) return "applied";
    if (disabled && appliedIndices.includes(i)) return "applied";
    if (disabled && rejectedIndices.includes(i)) return "rejected";
    return "pending";
  };

  return (
    <div className="border border-border rounded-lg bg-card">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-card-foreground/5 cursor-pointer select-none hover:bg-card-foreground/10 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5">
          <ChevronRight
            className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", expanded && "rotate-90")}
          />
          <span className={cn("text-sm font-semibold", hasErrors ? "text-destructive" : "text-foreground")}>
            Proposed Changes{hasErrors ? " (errors present)" : ""}
          </span>
        </div>
        <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
          <button
            className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            onClick={handleToggleAll}
            disabled={disabled}
          >
            {selectedMods.length === modifications.length ? "Deselect All" : "Select All"}
          </button>
          <button
            className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            onClick={handleApply}
            disabled={disabled}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-2 flex flex-col gap-1.5">
          {modifications.map((mod, i) => {
            const status = getStatus(i);
            const isExpanded = expandedMods.includes(i);

            return (
              <div key={i} className="border border-border rounded-md overflow-hidden">
                {/* Item header */}
                <div
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-card hover:bg-card-foreground/5 transition-colors cursor-pointer"
                  onClick={() => handleExpandMod(i)}
                >
                  <input
                    type="checkbox"
                    checked={selectedMods.includes(i)}
                    onChange={() => handleToggle(i)}
                    disabled={disabled}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded accent-primary w-3.5 h-3.5 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span
                    className={cn(
                      "flex-1 text-xs font-medium",
                      status === "applied" && "text-green-600",
                      status === "rejected" && "text-muted-foreground",
                      status === "error" && "text-destructive"
                    )}
                  >
                    {status === "applied" && <CheckCircle className="w-3 h-3 inline mr-1" />}
                    {status === "rejected" && <XCircle className="w-3 h-3 inline mr-1" />}
                    {status === "error" && <AlertCircle className="w-3 h-3 inline mr-1" />}
                    {mod.task}
                  </span>
                  <ChevronRight
                    className={cn("w-3 h-3 text-muted-foreground transition-transform", isExpanded && "rotate-90")}
                  />
                </div>

                {/* Item body */}
                {isExpanded && (
                  <div className="px-2.5 pb-2.5 pt-1 pl-8 text-xs text-foreground">
                    <div className="font-semibold text-muted-foreground mb-1">
                      {formatAction(mod.action)}{mod.action !== "delete" ? " with..." : ""}
                    </div>
                    {mod.new_text && (
                      <div className="bg-muted rounded px-2 py-1.5 whitespace-pre-wrap break-words text-foreground">
                        {mod.new_text}
                      </div>
                    )}
                    {errors[i] && (
                      <div className="mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-destructive">
                        <strong>Error:</strong> {errors[i]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModificationReview;

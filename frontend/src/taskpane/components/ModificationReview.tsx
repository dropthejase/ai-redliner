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
  withinPara?: {
    find: string;
    occurrence: number;
  };
}

interface ModificationReviewProps {
  modifications: Action[];
  onApply: (appliedIndices: number[], rejectedIndices: number[], hashMismatch?: boolean) => void;
  disabled: boolean;
  appliedIndices?: number[];
  rejectedIndices?: number[];
  documentHashWhenSent?: string | null;
  onHashMismatch?: () => void;
  expandedByDefault?: boolean;
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
      const regularMatch = loc.match(/^p(\d+)$/);
      const tableMatch = loc.match(/^t(\d+)\.r(\d+)\.c(\d+)\.p(\d+)$/);

      if (regularMatch) {
        const paragraphIndex = parseInt(regularMatch[1]);
        const paragraphs = context.document.body.paragraphs;
        paragraphs.load("items");
        await context.sync();

        if (paragraphIndex < 0 || paragraphIndex >= paragraphs.items.length) return;

        const paragraph = paragraphs.items[paragraphIndex];
        const range = paragraph.getRange("Content");
        range.select();
        await context.sync();
      } else if (tableMatch) {
        const [, t, r, c, p] = tableMatch;
        const tableIndex = parseInt(t);
        const rowIndex = parseInt(r);
        const colIndex = parseInt(c);
        const paraIndex = parseInt(p);

        const tables = context.document.body.tables;
        tables.load("items");
        await context.sync();

        if (tableIndex < 0 || tableIndex >= tables.items.length) return;

        const table = tables.items[tableIndex];
        table.load("rowCount");
        table.rows.load("items");
        await context.sync();

        if (rowIndex < 0 || rowIndex >= table.rows.items.length) return;

        const row = table.rows.items[rowIndex];
        row.load("cellCount");
        row.cells.load("items");
        await context.sync();

        if (colIndex < 0 || colIndex >= row.cells.items.length) return;

        const cell = row.cells.items[colIndex];
        const cellParas = cell.body.paragraphs;
        cellParas.load("items");
        await context.sync();

        if (paraIndex < 0 || paraIndex >= cellParas.items.length) return;

        const paragraph = cellParas.items[paraIndex];
        const range = paragraph.getRange("Content");
        range.select();
        await context.sync();
      }
    });
  } catch (error) {
    console.error(`Error navigating to ${loc}:`, error);
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
  expandedByDefault,
}) => {
  const [expanded, setExpanded] = React.useState(expandedByDefault ?? !disabled);
  const [selectedMods, setSelectedMods] = React.useState<number[]>(
    modifications.map((_, i) => i)
  );
  const [expandedMods, setExpandedMods] = React.useState<number[]>([]);
  const [editedTexts, setEditedTexts] = React.useState<Record<number, string>>({});
  const [errors, setErrors] = React.useState<Record<number, string>>({});
  const [successes, setSuccesses] = React.useState<Record<number, boolean>>({});

  const mountedRef = React.useRef(false);
  React.useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
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
    if (!disabled && !expandedMods.includes(index) && modifications[index].loc) {
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
        onApply([], modifications.map((_, i) => i), true);
        return;
      }
    }

    const modsToApply = modifications
      .map((mod, i) => ({
        ...mod,
        ...(i in editedTexts ? { new_text: editedTexts[i] } : {}),
        originalIndex: i,
      }))
      .filter((mod) => selectedMods.includes(mod.originalIndex))
      .sort((a, b) => {
        // Classify operation types
        const getOperationType = (mod: typeof a): "paragraph" | "table_cell" | "table_row" => {
          if (mod.action === "delete_row" || mod.action === "insert_row") {
            return "table_row";
          }
          if (mod.loc?.match(/^t\d+\.r\d+\.c\d+\.p\d+$/)) {
            return "table_cell";
          }
          return "paragraph";
        };

        const aType = getOperationType(a);
        const bType = getOperationType(b);

        // Priority: paragraph operations first, then table_cell, then table_row
        const typePriority = { paragraph: 0, table_cell: 1, table_row: 2 };
        if (typePriority[aType] !== typePriority[bType]) {
          return typePriority[aType] - typePriority[bType];
        }

        // Within same type, sort by location
        const parseLocation = (loc: string | undefined): number[] => {
          if (!loc) return [0];

          const regularMatch = loc.match(/^p(\d+)$/);
          if (regularMatch) {
            return [parseInt(regularMatch[1])];
          }

          const tableCellMatch = loc.match(/^t(\d+)\.r(\d+)\.c(\d+)\.p(\d+)$/);
          if (tableCellMatch) {
            const [, t, r, c, p] = tableCellMatch;
            return [parseInt(t), parseInt(r), parseInt(c), parseInt(p)];
          }

          const tableRowMatch = loc.match(/^t(\d+)\.r(\d+)$/);
          if (tableRowMatch) {
            const [, t, r] = tableRowMatch;
            return [parseInt(t), parseInt(r)];
          }

          return [0];
        };

        const aKeys = parseLocation(a.loc);
        const bKeys = parseLocation(b.loc);

        // Compare lexicographically in reverse order (descending)
        for (let i = 0; i < Math.max(aKeys.length, bKeys.length); i++) {
          const aKey = aKeys[i] ?? 0;
          const bKey = bKeys[i] ?? 0;
          if (aKey !== bKey) {
            return bKey - aKey;
          }
        }

        // If locations are identical, sort by withinPara occurrence in descending order
        // (higher occurrence executes first to avoid invalidating earlier occurrences)
        const aOccurrence = a.withinPara?.occurrence ?? -1;
        const bOccurrence = b.withinPara?.occurrence ?? -1;
        if (aOccurrence !== bOccurrence) {
          return bOccurrence - aOccurrence;
        }

        return 0;
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

    // If there are errors, keep panel expanded and auto-expand failed items
    if (Object.keys(newErrors).length > 0) {
      setExpanded(true);
      setExpandedMods(Object.keys(newErrors).map(Number));
    } else {
      setExpanded(false);
    }

    onApply(applied, rejected);
  };

  const hasErrors = Object.keys(errors).length > 0;
  const errorCount = Object.keys(errors).length;
  const successCount = Object.keys(successes).length;

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
            Proposed Changes
            {hasErrors && ` (${errorCount} failed${successCount > 0 ? `, ${successCount} succeeded` : ""})`}
          </span>
        </div>
        {!disabled && (
          <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
            <button
              className="text-xs text-primary hover:underline"
              onClick={handleToggleAll}
            >
              {selectedMods.length === modifications.length ? "Deselect All" : "Select All"}
            </button>
            <button
              className="text-xs text-primary hover:underline"
              onClick={handleApply}
            >
              Apply
            </button>
          </div>
        )}
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
                    {(mod.new_text || i in editedTexts) && (
                      disabled ? (
                        <div className="bg-muted rounded px-2 py-1.5 whitespace-pre-wrap break-words text-foreground">
                          {mod.new_text}
                        </div>
                      ) : (
                        <textarea
                          className="w-full bg-muted rounded px-2 py-1.5 text-foreground text-xs resize-none border border-transparent focus:border-primary focus:outline-none"
                          rows={Math.max(2, (editedTexts[i] ?? mod.new_text ?? "").split("\n").length)}
                          value={editedTexts[i] ?? mod.new_text ?? ""}
                          onChange={(e) => setEditedTexts((prev) => ({ ...prev, [i]: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )
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

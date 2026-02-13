/* global Word console */

import { executeReplace } from "./microsoft-actions/replace";
import { executeAppend } from "./microsoft-actions/append";
import { executeDelete } from "./microsoft-actions/delete";
import { executeHighlight } from "./microsoft-actions/highlight";
import { executeFormatBold } from "./microsoft-actions/format_bold";
import { executeFormatItalic } from "./microsoft-actions/format_italic";
import { executeStrikethrough } from "./microsoft-actions/strikethrough";
import { executeDeleteRow } from "./microsoft-actions/delete_row";
import { executeInsertRow } from "./microsoft-actions/insert_row";
import { executeCreateTable } from "./microsoft-actions/create_table";
import { executeDeleteTable } from "./microsoft-actions/delete_table";

interface MicrosoftAction {
  action: string;
  loc: string;
  new_text?: string;
  comment?: string;
  withinPara?: {
    find: string;
    occurrence: number;
  };
  rowData?: string[][]; // For insert_row actions: array of rows, each row is array of cell contents
  [key: string]: unknown;
}

async function createParagraphMapping(): Promise<Record<string, string>> {
  return await Word.run(async (context: Word.RequestContext) => {
    const body = context.document.body;
    const paragraphs = body.paragraphs;

    paragraphs.load("items");
    await context.sync();

    // Load parentTableCellOrNullObject and text for each paragraph
    for (const para of paragraphs.items) {
      para.load(["parentTableCellOrNullObject", "text"]);
    }
    await context.sync();

    // For paragraphs in tables, load cell rowIndex and cellIndex
    for (const para of paragraphs.items) {
      const parentCell = para.parentTableCellOrNullObject;
      if (parentCell && !parentCell.isNullObject) {
        parentCell.load(["rowIndex", "cellIndex"]);
      }
    }
    await context.sync();

    // Build mapping by iterating through paragraphs in document order
    // New format: {docPosition}.{originalKey}
    // - Text paragraphs: "0.p0", "8.p8"
    // - Table cells: "1.t0.r0.c0.p0"
    const paragraphMapping: Record<string, string> = {};
    let docPosition = 0; // Absolute position in document
    let tableCounter = 0;
    let insideTable = false;

    // Track paragraph index per cell: "t0.r1.c2" -> 3 (means we've seen 3 paras in that cell)
    const cellParaCounters = new Map<string, number>();

    // Debug: Build raw paragraph list
    const rawParaList = paragraphs.items
      .map((p, i) => `p${i}: ${p.text}`)
      .join("\n");

    for (let i = 0; i < paragraphs.items.length; i++) {
      const para = paragraphs.items[i];
      const parentCell = para.parentTableCellOrNullObject;

      if (!parentCell || parentCell.isNullObject) {
        // Regular paragraph - not in a table
        if (insideTable) {
          // Just exited a table
          tableCounter++;
          cellParaCounters.clear(); // Reset for next table
          insideTable = false;
        }

        paragraphMapping[`${docPosition}.p${i}`] = para.text;
        docPosition++;
      } else {
        // This paragraph is in a table cell
        if (!insideTable) {
          // Just entered a new table
          insideTable = true;
        }

        const rowIndex = parentCell.rowIndex;
        const cellIndex = parentCell.cellIndex;
        const cellKey = `t${tableCounter}.r${rowIndex}.c${cellIndex}`;

        // Get current paragraph index for this cell (defaults to 0 if first time)
        const paraIndexInCell = cellParaCounters.get(cellKey) || 0;
        cellParaCounters.set(cellKey, paraIndexInCell + 1);

        paragraphMapping[`${docPosition}.${cellKey}.p${paraIndexInCell}`] = para.text;
        docPosition++;
      }
    }

    // If we ended inside a table, increment counter
    if (insideTable) {
      tableCounter++;
    }

    // Debug: Log raw paragraph list
    console.log(
      "=== Paragraphs Only ===\n" + rawParaList + "\n" + "=".repeat(50),
    );

    // Debug: Log full paragraph mapping with docPosition.key format
    const mappingDisplay = Object.entries(paragraphMapping)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    console.log(
      "=== Paragraph Mapping ===\n" + mappingDisplay + "\n" + "=".repeat(50),
    );

    return paragraphMapping;
  });
}

export async function isDocumentEmpty(): Promise<boolean> {
  return await Word.run(async (context: Word.RequestContext) => {
    const body = context.document.body;
    body.load("text");
    await context.sync();
    return !body.text || body.text.trim().length === 0;
  });
}

/**
 * Switches the Word view to Simple Markup mode for consistent hash calculation.
 * Requires WordApiDesktop 1.4 or higher.
 */
async function switchToSimpleMarkupMode(): Promise<void> {
  try {
    await Word.run(async (context: Word.RequestContext) => {
      const revisionsFilter = context.document.activeWindow.view.revisionsFilter;
      revisionsFilter.set({ markup: "Simple" });
      await context.sync();
    });
  } catch (viewError) {
    console.log("Note: Could not set Simple Markup mode:", viewError);
    // Continue anyway - this is a nice-to-have, not critical
  }
}

export async function getWordDocumentContent(): Promise<string> {
  try {
    // Set Simple Markup mode for consistent hash calculation
    await switchToSimpleMarkupMode();

    const paragraphMapping = await createParagraphMapping();
    return Object.entries(paragraphMapping)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
  } catch (error) {
    console.log("Error getting document content: " + error);
    return "";
  }
}

export async function getSelectedText(): Promise<string | null> {
  try {
    return await Word.run(async (context: Word.RequestContext) => {
      const selection = context.document.getSelection();
      selection.load("text");
      await context.sync();
      return selection.text || null;
    });
  } catch (error) {
    console.log("Error getting selected text: " + error);
    return null;
  }
}

/**
 * Resolves a location string to a Word.Paragraph or Word.Range.
 * Supports formats:
 * - "5.p5" - regular paragraph
 * - "2.t0.r1.c2.p0" - table cell paragraph
 * - "10.t1" - entire table (returns table range)
 * - "10.t0.r2" - table row (returns row range)
 * If withinPara is provided, searches within the paragraph and returns the specific Range occurrence.
 */
export async function resolveLocation(
  context: Word.RequestContext,
  loc: string,
  withinPara?: { find: string; occurrence: number },
  preloadedParagraphs?: Word.ParagraphCollection,
): Promise<Word.Paragraph | Word.Range> {
  // Parse location - new format: {docPosition}.{key}
  const regularMatch = loc.match(/^\d+\.p(\d+)$/);
  const tableCellMatch = loc.match(/^\d+\.t(\d+)\.r(\d+)\.c(\d+)\.p(\d+)$/);
  const tableOnlyMatch = loc.match(/^\d+\.t(\d+)$/);
  const tableRowMatch = loc.match(/^\d+\.t(\d+)\.r(\d+)$/);

  // Handle table-only format (e.g., "10.t1" for delete_table)
  if (tableOnlyMatch) {
    const tableIndex = parseInt(tableOnlyMatch[1]);
    const tables = context.document.body.tables;
    tables.load("items");
    await context.sync();

    if (tableIndex < 0 || tableIndex >= tables.items.length) {
      throw new Error(`Table index ${tableIndex} out of range (0-${tables.items.length - 1})`);
    }

    return tables.items[tableIndex].getRange();
  }

  // Handle table row format (e.g., "10.t0.r2" for delete_row/insert_row)
  if (tableRowMatch) {
    const tableIndex = parseInt(tableRowMatch[1]);
    const rowIndex = parseInt(tableRowMatch[2]);
    const tables = context.document.body.tables;
    tables.load("items");
    await context.sync();

    if (tableIndex < 0 || tableIndex >= tables.items.length) {
      throw new Error(`Table index ${tableIndex} out of range (0-${tables.items.length - 1})`);
    }

    const table = tables.items[tableIndex];
    table.rows.load("items");
    await context.sync();

    if (rowIndex < 0 || rowIndex >= table.rows.items.length) {
      throw new Error(`Row index ${rowIndex} out of range for table ${tableIndex} (0-${table.rows.items.length - 1})`);
    }

    return table.rows.items[rowIndex].range;
  }

  let targetParagraph: Word.Paragraph;

  if (regularMatch) {
    // Regular paragraph
    const paragraphIndex = parseInt(regularMatch[1]);
    const paragraphs = preloadedParagraphs || context.document.body.paragraphs;

    // Only load/sync if not already preloaded
    if (!preloadedParagraphs) {
      paragraphs.load("items");
      await context.sync();
    }

    if (paragraphIndex < 0 || paragraphIndex >= paragraphs.items.length) {
      throw new Error(
        `Paragraph index ${paragraphIndex} out of range (0-${paragraphs.items.length - 1})`,
      );
    }

    targetParagraph = paragraphs.items[paragraphIndex];
  } else if (tableCellMatch) {
    // Table cell paragraph
    const [, t, r, c, p] = tableCellMatch;
    const tableIndex = parseInt(t);
    const rowIndex = parseInt(r);
    const colIndex = parseInt(c);
    const paraIndex = parseInt(p);

    const tables = context.document.body.tables;
    tables.load("items");
    await context.sync();

    if (tableIndex < 0 || tableIndex >= tables.items.length) {
      throw new Error(
        `Table index ${tableIndex} out of range (0-${tables.items.length - 1})`,
      );
    }

    const table = tables.items[tableIndex];
    table.load("rowCount");
    table.rows.load("items");
    await context.sync();

    if (rowIndex < 0 || rowIndex >= table.rows.items.length) {
      throw new Error(
        `Row index ${rowIndex} out of range for table ${tableIndex} (0-${table.rows.items.length - 1})`,
      );
    }

    const row = table.rows.items[rowIndex];
    row.load("cellCount");
    row.cells.load("items");
    await context.sync();

    if (colIndex < 0 || colIndex >= row.cells.items.length) {
      throw new Error(
        `Column index ${colIndex} out of range for table ${tableIndex} row ${rowIndex} (0-${row.cells.items.length - 1})`,
      );
    }

    const cell = row.cells.items[colIndex];
    const cellParas = cell.body.paragraphs;
    cellParas.load("items");
    await context.sync();

    if (paraIndex < 0 || paraIndex >= cellParas.items.length) {
      throw new Error(
        `Paragraph index ${paraIndex} out of range in table ${tableIndex} cell [${rowIndex},${colIndex}] (0-${cellParas.items.length - 1})`,
      );
    }

    targetParagraph = cellParas.items[paraIndex];
  } else {
    throw new Error(`Invalid location format: ${loc}`);
  }

  // If withinPara is specified, search within the paragraph
  if (withinPara) {
    const searchResults = targetParagraph.search(withinPara.find, {
      matchCase: true,
      matchWholeWord: false,
    });
    searchResults.load("items");
    await context.sync();

    if (searchResults.items.length === 0) {
      throw new Error(`Search text "${withinPara.find}" not found in ${loc}`);
    }

    if (
      withinPara.occurrence < 0 ||
      withinPara.occurrence >= searchResults.items.length
    ) {
      throw new Error(
        `Occurrence ${withinPara.occurrence} out of range for "${withinPara.find}" in ${loc} (found ${searchResults.items.length} matches)`,
      );
    }

    return searchResults.items[withinPara.occurrence];
  } else {
    // Return the paragraph object for node-level operations
    return targetParagraph;
  }
}

async function setTrackingMode(mode = "trackAll") {
  try {
    await Word.run(async (context: Word.RequestContext) => {
      context.document.changeTrackingMode =
        mode === "disable"
          ? Word.ChangeTrackingMode.off
          : Word.ChangeTrackingMode.trackAll;
      await context.sync();
    });
  } catch (error) {
    console.log("Error setting tracking mode: " + error);
  }
}

export async function executeWordAction(microsoftActions: MicrosoftAction[]) {
  const errors: string[] = [];

  try {
    await setTrackingMode("trackAll");

    await Word.run(async (context: Word.RequestContext) => {
      const paragraphs = context.document.body.paragraphs;
      paragraphs.load("items");
      await context.sync();

      // Sort actions by docPosition descending to avoid index shifting
      const sortedActions = [...microsoftActions].sort((a, b) => {
        const getDocPosition = (loc: string) => {
          const match = loc.match(/^(\d+)\./);
          return match ? parseInt(match[1]) : 0;
        };
        return getDocPosition(b.loc || "") - getDocPosition(a.loc || "");
      });

      for (const action of sortedActions) {
        try {
          // Log execution order
          const task = (action as any).task || action.action;
          console.log(`Executing: ${task} (${action.loc})`);

          // Add comment if present - queued before action
          if (action.comment) {
            const target = await resolveLocation(context, action.loc, action.withinPara, paragraphs);
            const range = target instanceof Word.Paragraph ? target.getRange() : target;
            range.insertComment(action.comment);
          }

          switch (action.action) {
            case "none":
              break;
            case "replace":
              await executeReplace(context, action, paragraphs);
              break;
            case "append":
              await executeAppend(context, action, paragraphs);
              break;
            case "delete":
              await executeDelete(context, action, paragraphs);
              break;
            case "highlight":
              await executeHighlight(context, action, paragraphs);
              break;
            case "format_bold":
              await executeFormatBold(context, action, paragraphs);
              break;
            case "format_italic":
              await executeFormatItalic(context, action, paragraphs);
              break;
            case "strikethrough":
              await executeStrikethrough(context, action, paragraphs);
              break;
            case "delete_row":
              await executeDeleteRow(context, action, paragraphs);
              break;
            case "insert_row":
              await executeInsertRow(context, action, paragraphs);
              break;
            case "create_table":
              await executeCreateTable(context, action, paragraphs);
              break;
            case "delete_table":
              await executeDeleteTable(context, action, paragraphs);
              break;
            default:
              console.log(`Unknown action: ${action.action}`);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`❌ ${action.action.toUpperCase()}: ${msg}`);
        }
      }

      await context.sync();
    });

    if (errors.length > 0) {
      throw new Error(`Some actions failed:\n\n${errors.join("\n\n")}`);
    }
  } catch (error) {
    console.log("Error executing Word actions: " + error);
    throw error;
  }
}

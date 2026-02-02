/* global Word console */

import { executeReplace } from "./microsoft-actions/replace";
import { executeAppend } from "./microsoft-actions/append";
import { executePrepend } from "./microsoft-actions/prepend";
import { executeDelete } from "./microsoft-actions/delete";
import { executeHighlight } from "./microsoft-actions/highlight";
import { executeFormatBold } from "./microsoft-actions/format_bold";
import { executeFormatItalic } from "./microsoft-actions/format_italic";
import { executeStrikethrough } from "./microsoft-actions/strikethrough";
import { executeDeleteRow } from "./microsoft-actions/delete_row";
import { executeInsertRow } from "./microsoft-actions/insert_row";

interface MicrosoftAction {
  action: string;
  loc: string;
  new_text?: string;
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
    const paragraphMapping: Record<string, string> = {};
    let globalParaCounter = 0; // Tracks position in entire document (for regular paragraph indexing)
    let tableCounter = 0;
    let insideTable = false;

    // Track paragraph index per cell: "t0.r1.c2" -> 3 (means we've seen 3 paras in that cell)
    const cellParaCounters = new Map<string, number>();

    // Debug: Build raw paragraph list
    const rawParaList = paragraphs.items.map((p, i) => `p${i}: ${p.text}`).join("\n");

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

        paragraphMapping[`p${globalParaCounter}`] = para.text;
        globalParaCounter++;
      } else {
        // This paragraph is in a table cell
        if (!insideTable) {
          // Just entered a new table
          paragraphMapping[`t${tableCounter}`] = "[Table]";
          insideTable = true;
        }

        const rowIndex = parentCell.rowIndex;
        const cellIndex = parentCell.cellIndex;
        const cellKey = `t${tableCounter}.r${rowIndex}.c${cellIndex}`;

        // Get current paragraph index for this cell (defaults to 0 if first time)
        const paraIndexInCell = cellParaCounters.get(cellKey) || 0;
        cellParaCounters.set(cellKey, paraIndexInCell + 1);

        paragraphMapping[`${cellKey}.p${paraIndexInCell}`] = para.text;
        globalParaCounter++; // Table cell paragraphs also consume global indices
      }
    }

    // Debug: Log raw paragraph list
    console.log("=== Paragraphs Only ===\n" + rawParaList + "\n" + "=".repeat(50));

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

export async function getWordDocumentContent(): Promise<string> {
  try {
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
 * Resolves a location string (e.g., "p5", "t0.r1.c2.p0") to a Word.Range.
 * If withinPara is provided, searches within the paragraph and returns the specific occurrence.
 */
export async function resolveLocation(
  context: Word.RequestContext,
  loc: string,
  withinPara?: { find: string; occurrence: number }
): Promise<Word.Range> {
  // Parse location
  const regularMatch = loc.match(/^p(\d+)$/);
  const tableMatch = loc.match(/^t(\d+)\.r(\d+)\.c(\d+)\.p(\d+)$/);

  let targetParagraph: Word.Paragraph;

  if (regularMatch) {
    // Regular paragraph
    const paragraphIndex = parseInt(regularMatch[1]);
    const paragraphs = context.document.body.paragraphs;
    paragraphs.load("items");
    await context.sync();

    if (paragraphIndex < 0 || paragraphIndex >= paragraphs.items.length) {
      throw new Error(`Paragraph index ${paragraphIndex} out of range (0-${paragraphs.items.length - 1})`);
    }

    targetParagraph = paragraphs.items[paragraphIndex];
  } else if (tableMatch) {
    // Table cell paragraph
    const [, t, r, c, p] = tableMatch;
    const tableIndex = parseInt(t);
    const rowIndex = parseInt(r);
    const colIndex = parseInt(c);
    const paraIndex = parseInt(p);

    const tables = context.document.body.tables;
    tables.load("items");
    await context.sync();

    if (tableIndex < 0 || tableIndex >= tables.items.length) {
      throw new Error(`Table index ${tableIndex} out of range (0-${tables.items.length - 1})`);
    }

    const table = tables.items[tableIndex];
    table.load("rowCount");
    table.rows.load("items");
    await context.sync();

    if (rowIndex < 0 || rowIndex >= table.rows.items.length) {
      throw new Error(`Row index ${rowIndex} out of range for table ${tableIndex} (0-${table.rows.items.length - 1})`);
    }

    const row = table.rows.items[rowIndex];
    row.load("cellCount");
    row.cells.load("items");
    await context.sync();

    if (colIndex < 0 || colIndex >= row.cells.items.length) {
      throw new Error(`Column index ${colIndex} out of range for table ${tableIndex} row ${rowIndex} (0-${row.cells.items.length - 1})`);
    }

    const cell = row.cells.items[colIndex];
    const cellParas = cell.body.paragraphs;
    cellParas.load("items");
    await context.sync();

    if (paraIndex < 0 || paraIndex >= cellParas.items.length) {
      throw new Error(`Paragraph index ${paraIndex} out of range in table ${tableIndex} cell [${rowIndex},${colIndex}] (0-${cellParas.items.length - 1})`);
    }

    targetParagraph = cellParas.items[paraIndex];
  } else {
    throw new Error(`Invalid location format: ${loc}`);
  }

  // If withinPara is specified, search within the paragraph
  if (withinPara) {
    const searchResults = targetParagraph.search(withinPara.find, { matchCase: true, matchWholeWord: false });
    searchResults.load("items");
    await context.sync();

    if (searchResults.items.length === 0) {
      throw new Error(`Search text "${withinPara.find}" not found in ${loc}`);
    }

    if (withinPara.occurrence < 0 || withinPara.occurrence >= searchResults.items.length) {
      throw new Error(`Occurrence ${withinPara.occurrence} out of range for "${withinPara.find}" in ${loc} (found ${searchResults.items.length} matches)`);
    }

    return searchResults.items[withinPara.occurrence];
  } else {
    // Return the entire paragraph content range
    return targetParagraph.getRange("Content");
  }
}

async function setTrackingMode(mode = "trackAll") {
  try {
    await Word.run(async (context: Word.RequestContext) => {
      context.document.changeTrackingMode =
        mode === "disable" ? Word.ChangeTrackingMode.off : Word.ChangeTrackingMode.trackAll;
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

      for (const action of microsoftActions) {
        try {
          switch (action.action) {
            case "none":
              break;
            case "replace":
              await executeReplace(context, action, paragraphs);
              break;
            case "append":
              await executeAppend(context, action, paragraphs);
              break;
            case "prepend":
              await executePrepend(context, action, paragraphs);
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

    // Turn tracking back off so Word doesn't keep tracking user edits
    await setTrackingMode("disable");

    if (errors.length > 0) {
      throw new Error(`Some actions failed:\n\n${errors.join("\n\n")}`);
    }
  } catch (error) {
    console.log("Error executing Word actions: " + error);
    throw error;
  }
}

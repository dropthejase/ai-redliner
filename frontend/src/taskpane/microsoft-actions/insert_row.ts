/* global Word console */

interface MicrosoftAction {
  loc?: string;
  rowData?: string[][];
  [key: string]: unknown;
}

export async function executeInsertRow(context: Word.RequestContext, microsoftAction: MicrosoftAction, paragraphs: Word.ParagraphCollection) {
  const { loc, rowData } = microsoftAction;

  if (!loc) {
    return;
  }

  try {
    // Parse location: {docPosition}.t{n}.r{m} - insert after row m in table n
    const match = loc.match(/^\d+\.t(\d+)\.r(\d+)$/);

    if (!match) {
      throw new Error(`Invalid row location format: ${loc}. Expected format: {docPosition}.t{n}.r{m}`);
    }

    const tableIndex = parseInt(match[1]);
    const rowIndex = parseInt(match[2]);

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

    // Get the target row and insert after it using TableRow.insertRows()
    const targetRow = table.rows.items[rowIndex];
    targetRow.insertRows("After", rowData?.length ?? 1, rowData);
  } catch (error) {
    throw new Error(
      `Insert row operation failed: ${error instanceof Error ? error.message : error}\nAction: ${JSON.stringify(microsoftAction, null, 2)}`
    );
  }
}

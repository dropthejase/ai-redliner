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
    // Parse location - could be:
    // - t{n}.r{m} - insert before row m in table n
    // - t{n}.r{m}.after - insert after row m in table n
    const beforeMatch = loc.match(/^t(\d+)\.r(\d+)$/);
    const afterMatch = loc.match(/^t(\d+)\.r(\d+)\.after$/);

    let tableIndex: number;
    let rowIndex: number;
    let insertLocation: "Before" | "After";

    if (beforeMatch) {
      tableIndex = parseInt(beforeMatch[1]);
      rowIndex = parseInt(beforeMatch[2]);
      insertLocation = "Before";
    } else if (afterMatch) {
      tableIndex = parseInt(afterMatch[1]);
      rowIndex = parseInt(afterMatch[2]);
      insertLocation = "After";
    } else {
      throw new Error(`Invalid row location format: ${loc}. Expected format: t{n}.r{m} or t{n}.r{m}.after`);
    }

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

    // Get the target row and insert relative to it using TableRow.insertRows()
    const targetRow = table.rows.items[rowIndex];
    targetRow.insertRows(insertLocation, rowData?.length ?? 1, rowData);

    await context.sync();
  } catch (error) {
    throw new Error(
      `Insert row operation failed: ${error instanceof Error ? error.message : error}\nAction: ${JSON.stringify(microsoftAction, null, 2)}`
    );
  }
}

/* global Word console */

interface MicrosoftAction {
  loc?: string;
  [key: string]: unknown;
}

export async function executeDeleteRow(context: Word.RequestContext, microsoftAction: MicrosoftAction, paragraphs: Word.ParagraphCollection) {
  const { loc } = microsoftAction;

  if (!loc) {
    return;
  }

  try {
    const rowMatch = loc.match(/^t(\d+)\.r(\d+)$/);
    if (!rowMatch) {
      throw new Error(`Invalid row location format: ${loc}. Expected format: t{tableIndex}.r{rowIndex}`);
    }

    const [, t, r] = rowMatch;
    const tableIndex = parseInt(t);
    const rowIndex = parseInt(r);

    const tables = context.document.body.tables;
    tables.load("items");
    await context.sync();

    if (tableIndex < 0 || tableIndex >= tables.items.length) {
      throw new Error(`Table index ${tableIndex} out of range (0-${tables.items.length - 1})`);
    }

    const table = tables.items[tableIndex];
    table.load("rowCount");
    await context.sync();

    if (rowIndex < 0 || rowIndex >= table.rowCount) {
      throw new Error(`Row index ${rowIndex} out of range for table ${tableIndex} (0-${table.rowCount - 1})`);
    }

    table.deleteRows(rowIndex, 1);
  } catch (error) {
    throw new Error(
      `Delete row operation failed: ${error instanceof Error ? error.message : error}\nAction: ${JSON.stringify(microsoftAction, null, 2)}`
    );
  }
}

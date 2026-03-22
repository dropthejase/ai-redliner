/* global Word console */

interface MicrosoftAction {
  loc?: string;
  [key: string]: unknown;
}

export async function executeDeleteTable(context: Word.RequestContext, microsoftAction: MicrosoftAction, paragraphs: Word.ParagraphCollection) {
  const { loc } = microsoftAction;

  if (!loc) {
    return;
  }

  try {
    // Parse location: {docPosition}.t{n} - delete entire table n
    const match = loc.match(/^\d+\.t(\d+)$/);

    if (!match) {
      throw new Error(`Invalid table location format: ${loc}. Expected format: {docPosition}.t{n}`);
    }

    const tableIndex = parseInt(match[1]);

    const tables = context.document.body.tables;
    tables.load("items");
    await context.sync();

    if (tableIndex < 0 || tableIndex >= tables.items.length) {
      throw new Error(`Table index ${tableIndex} out of range (0-${tables.items.length - 1})`);
    }

    const table = tables.items[tableIndex];
    table.delete();
  } catch (error) {
    throw new Error(
      `Delete table operation failed: ${error instanceof Error ? error.message : error}\nAction: ${JSON.stringify(microsoftAction, null, 2)}`
    );
  }
}

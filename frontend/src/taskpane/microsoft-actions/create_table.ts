/* global Word console */

interface MicrosoftAction {
  loc?: string;
  rowCount?: number;
  columnCount?: number;
  values?: string[][];
  [key: string]: unknown;
}

export async function executeCreateTable(context: Word.RequestContext, microsoftAction: MicrosoftAction, paragraphs: Word.ParagraphCollection) {
  const { loc, rowCount, columnCount, values } = microsoftAction;

  if (!loc || !rowCount || !columnCount) {
    throw new Error(`create_table requires loc, rowCount, and columnCount`);
  }

  try {
    // Parse location: {docPosition}.p{n} - create table after paragraph n
    const match = loc.match(/^\d+\.p(\d+)$/);

    if (!match) {
      throw new Error(`Invalid paragraph location format: ${loc}. Expected format: {docPosition}.p{n}`);
    }

    const paraIndex = parseInt(match[1]);

    paragraphs.load("items");
    await context.sync();

    if (paraIndex < 0 || paraIndex >= paragraphs.items.length) {
      throw new Error(`Paragraph index ${paraIndex} out of range (0-${paragraphs.items.length - 1})`);
    }

    const targetParagraph = paragraphs.items[paraIndex];

    // Insert table after the target paragraph
    const newTable = targetParagraph.insertTable(rowCount, columnCount, "After", values);
  } catch (error) {
    throw new Error(
      `Create table operation failed: ${error instanceof Error ? error.message : error}\nAction: ${JSON.stringify(microsoftAction, null, 2)}`
    );
  }
}

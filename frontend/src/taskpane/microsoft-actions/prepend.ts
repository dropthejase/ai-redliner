/* global Word console */

interface MicrosoftAction {
  loc?: string;
  new_text?: string;
  [key: string]: unknown;
}

export async function executePrepend(context: Word.RequestContext, microsoftAction: MicrosoftAction, paragraphs: Word.ParagraphCollection) {
  const { loc, new_text } = microsoftAction;

  if (!loc) {
    return;
  }

  try {
    const match = loc.match(/^p(\d+)$/);
    if (!match) {
      throw new Error(`Invalid location format: ${loc}`);
    }

    const paragraphIndex = parseInt(match[1]);

    if (paragraphIndex < 0 || paragraphIndex >= paragraphs.items.length) {
      throw new Error(`Paragraph index ${paragraphIndex} out of range (0-${paragraphs.items.length - 1})`);
    }

    const paragraph = paragraphs.items[paragraphIndex];
    const range = paragraph.getRange("Content");
    range.insertText(new_text || "", Word.InsertLocation.start);
  } catch (error) {
    throw new Error(
      `Prepend operation failed: ${error instanceof Error ? error.message : error}\nAction: ${JSON.stringify(microsoftAction, null, 2)}`
    );
  }
}

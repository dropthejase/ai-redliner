/* global Word console */

import { resolveLocation } from "../taskpane";

interface MicrosoftAction {
  loc?: string;
  new_text?: string;
  withinPara?: {
    find: string;
    occurrence: number;
  };
  [key: string]: unknown;
}

export async function executeAppend(context: Word.RequestContext, microsoftAction: MicrosoftAction, paragraphs: Word.ParagraphCollection) {
  const { loc, new_text, withinPara } = microsoftAction;

  if (!loc) {
    return;
  }

  try {
    const range = await resolveLocation(context, loc, withinPara);
    range.insertText(new_text || "", Word.InsertLocation.end);
  } catch (error) {
    throw new Error(
      `Append operation failed: ${error instanceof Error ? error.message : error}\nAction: ${JSON.stringify(microsoftAction, null, 2)}`
    );
  }
}

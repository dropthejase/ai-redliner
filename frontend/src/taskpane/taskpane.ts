/* global Word console */

import { executeReplace } from "./microsoft-actions/replace";
import { executeAppend } from "./microsoft-actions/append";
import { executePrepend } from "./microsoft-actions/prepend";
import { executeDelete } from "./microsoft-actions/delete";
import { executeHighlight } from "./microsoft-actions/highlight";
import { executeFormatBold } from "./microsoft-actions/format_bold";
import { executeFormatItalic } from "./microsoft-actions/format_italic";
import { executeStrikethrough } from "./microsoft-actions/strikethrough";

interface MicrosoftAction {
  action: string;
  loc: string;
  new_text?: string;
  [key: string]: unknown;
}

async function createParagraphMapping(): Promise<Record<string, string>> {
  return await Word.run(async (context: Word.RequestContext) => {
    const paragraphs = context.document.body.paragraphs;
    paragraphs.load("items");
    await context.sync();

    const ranges: Word.Range[] = [];
    for (let i = 0; i < paragraphs.items.length; i++) {
      const paragraph = paragraphs.items[i];
      const range = paragraph.getRange("Content");
      range.load("text");
      ranges.push(range);
    }

    await context.sync();

    const paragraphMapping: Record<string, string> = {};
    for (let i = 0; i < ranges.length; i++) {
      paragraphMapping[`p${i}`] = ranges[i].text;
    }

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

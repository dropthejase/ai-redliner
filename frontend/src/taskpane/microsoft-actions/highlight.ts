/* global console */

import { resolveLocation } from "../taskpane";

interface MicrosoftAction {
  loc?: string;
  withinPara?: {
    find: string;
    occurrence: number;
  };
  [key: string]: unknown;
}

export async function executeHighlight(context: Word.RequestContext, microsoftAction: MicrosoftAction, paragraphs: Word.ParagraphCollection) {
  const { loc, withinPara } = microsoftAction;

  if (!loc) {
    return;
  }

  try {
    const range = await resolveLocation(context, loc, withinPara);
    range.font.highlightColor = "Yellow";
  } catch (error) {
    throw new Error(
      `Highlight operation failed: ${error instanceof Error ? error.message : error}\nAction: ${JSON.stringify(microsoftAction, null, 2)}`
    );
  }
}

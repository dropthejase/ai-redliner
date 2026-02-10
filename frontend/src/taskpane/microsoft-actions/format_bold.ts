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

export async function executeFormatBold(context: Word.RequestContext, microsoftAction: MicrosoftAction, paragraphs: Word.ParagraphCollection) {
  const { loc, withinPara } = microsoftAction;

  if (!loc) {
    return;
  }

  try {
    const range = await resolveLocation(context, loc, withinPara, paragraphs);
    range.font.bold = true;
  } catch (error) {
    throw new Error(
      `Format bold operation failed: ${error instanceof Error ? error.message : error}\nAction: ${JSON.stringify(microsoftAction, null, 2)}`
    );
  }
}

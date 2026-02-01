/* global console */

interface MicrosoftAction {
  loc?: string;
  [key: string]: unknown;
}

export async function executeFormatBold(context: Word.RequestContext, microsoftAction: MicrosoftAction, paragraphs: Word.ParagraphCollection) {
  const { loc } = microsoftAction;

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
    range.font.bold = true;
  } catch (error) {
    throw new Error(
      `Format bold operation failed: ${error instanceof Error ? error.message : error}\nAction: ${JSON.stringify(microsoftAction, null, 2)}`
    );
  }
}

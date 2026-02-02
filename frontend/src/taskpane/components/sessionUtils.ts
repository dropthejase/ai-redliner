import { PersistedMessage } from "./useChatAPI";

export interface RenderedMessage {
  type: "user" | "assistant" | "proposed_changes";
  text?: string;
  changeCount?: number;
}

// Extract <user_input>...</user_input> from a persisted user message text block
function extractUserInput(text: string): string {
  const match = text.match(/<user_input>([\s\S]*?)<\/user_input>/);
  return match ? match[1].trim() : text;
}

// Count actions in a toolUse block (actions is a JSON string)
function countActions(actionsJson: string): number {
  try {
    const parsed = JSON.parse(actionsJson);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

// Map raw persisted messages into display-ready messages.
// Rules:
//   - user: extract <user_input> tag
//   - assistant with only text: render as assistant bubble
//   - assistant with toolUse: render text block(s) as assistant bubble,
//     then a "N proposed changes" placeholder for the toolUse
//   - toolResult: skip
//   - empty content: skip
export function mapMessages(messages: PersistedMessage[]): RenderedMessage[] {
  const result: RenderedMessage[] = [];

  for (const msg of messages) {
    const { role, content } = msg.message;

    if (role === "user") {
      // Skip toolResult messages (they have toolResult in content, not text)
      const textBlock = content.find((block): block is { text: string } => "text" in block && typeof block.text === "string");
      if (!textBlock) continue;
      result.push({ type: "user", text: extractUserInput(textBlock.text) });
    } else if (role === "assistant") {
      if (!content || content.length === 0) continue;

      // Render text blocks as assistant bubble
      const textBlock = content.find((block): block is { text: string } => "text" in block && typeof block.text === "string");
      if (textBlock && textBlock.text.trim()) {
        result.push({ type: "assistant", text: textBlock.text });
      }

      // Render toolUse block as proposed changes placeholder
      const toolBlock = content.find(
        (block): block is { toolUse: { toolUseId: string; name: string; input: { actions: string } } } =>
          "toolUse" in block && block.toolUse?.name === "microsoft_actions_tool"
      );
      if (toolBlock) {
        const count = countActions(toolBlock.toolUse.input.actions);
        result.push({ type: "proposed_changes", changeCount: count });
      }
    }
    // toolResult and anything else: skip
  }

  return result;
}

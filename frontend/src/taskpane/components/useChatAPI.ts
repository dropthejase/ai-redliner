import { useState, useCallback } from "react";
import { getAutoApproveTools } from "./Settings";

interface MessagePayload {
  prompt: string;
  word_document: string;
  highlighted: string;
  model?: string;
  document_hash?: string;
}

type OnResponseCallback = (event: Record<string, unknown>) => void;

export interface SessionSummary {
  session_id: string;
  created_at: string;
}

export interface PersistedMessage {
  message: {
    role: string;
    content: Array<
      | { text?: string }
      | { toolUse?: { toolUseId: string; name: string; input: { actions: string } } }
      | { toolResult?: unknown }
    >;
  };
  message_id: number;
  created_at: string;
}

export const useChatAPI = () => {
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (sessionId: string, payload: MessagePayload, onResponse: OnResponseCallback) => {
    setError(null);

    try {
      const response = await fetch("https://localhost:8000/invoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
          "x-auto-approve-tools": String(getAutoApproveTools()),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      // Parse SSE stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const eventData = line.slice(6);
            try {
              const event = JSON.parse(eventData);
              console.log("Received SSE event:", event);
              onResponse(event);
            } catch (parseError) {
              console.error("Failed to parse SSE event:", eventData, parseError);
            }
          }
        }
      }

      return { status: "sent" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("sendMessage error:", err);
      setError(message);
      throw err;
    }
  };

  const fetchSessions = useCallback(async (): Promise<SessionSummary[]> => {
    const response = await fetch("https://localhost:8000/sessions");
    if (!response.ok) throw new Error(`Failed to fetch sessions: ${response.status}`);
    const data = await response.json();
    return data.sessions as SessionSummary[];
  }, []);

  const fetchMessages = useCallback(async (id: string): Promise<PersistedMessage[]> => {
    const response = await fetch(`https://localhost:8000/sessions/${id}/messages`);
    if (!response.ok) throw new Error(`Failed to fetch messages: ${response.status}`);
    const data = await response.json();
    return data.messages as PersistedMessage[];
  }, []);

  const deleteSession = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`https://localhost:8000/sessions/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(`Failed to delete session: ${response.status}`);
  }, []);

  return { sendMessage, error, fetchSessions, fetchMessages, deleteSession };
};

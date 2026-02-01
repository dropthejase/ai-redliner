import { useState, useRef, useEffect } from "react";

interface MessagePayload {
  prompt: string;
  word_document: string;
  highlighted: string;
}

type OnResponseCallback = (event: Record<string, unknown>) => void;

export const useChatAPI = () => {
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Generate session ID once on mount
  useEffect(() => {
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  const sendMessage = async (payload: MessagePayload, onResponse: OnResponseCallback) => {
    setError(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/invoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionIdRef.current || "default",
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

  return { sendMessage, error };
};

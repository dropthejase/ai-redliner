import * as React from "react";
import { AlertCircle, X, MessageSquare } from "lucide-react";
import ChatInput from "./ChatInput";
import ChatMessageList from "./ChatMessageList";
import { useChatAPI } from "./useChatAPI";
import { mapMessages } from "./sessionUtils";
import {
  getWordDocumentContent,
  getSelectedText,
  isDocumentEmpty,
} from "../taskpane";

// Types
interface Action {
  task: string;
  action: string;
  loc: string;
  new_text?: string;
}

interface Message {
  role: string;
  content?: { text: string }[];
  tool_name?: string;
  actions?: Action[];
  actedUpon?: boolean;
  appliedIndices?: number[];
  rejectedIndices?: number[];
  failedIndices?: number[];
  errorMessages?: Record<number, string>;
  rejected?: boolean;
  hashMismatch?: boolean;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content: [
    {
      text: `**Hi there! I'm your AI-powered redlining assistant.**\n\nAsk me about the Word document or tell me how you want to modify it!\n\n⚠️ **Important:** I'm just a drafting tool and can make mistakes. Always review my suggestions carefully.\n\nHow can I help you today?`,
    },
  ],
};

interface ChatInterfaceProps {
  selectedModel: string;
  sessionId: string;
  onNewSession: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ selectedModel, sessionId, onNewSession }) => {
  const [messages, setMessages] = React.useState<Message[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = React.useState(false);
  const [pendingActions, setPendingActions] = React.useState<Action[]>([]);
  const [documentHashWhenSent, setDocumentHashWhenSent] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const prevModelRef = React.useRef(selectedModel);

  const { sendMessage, fetchMessages } = useChatAPI();

  // Model changed — start a fresh session
  React.useEffect(() => {
    if (selectedModel !== prevModelRef.current) {
      prevModelRef.current = selectedModel;
      onNewSession();
    }
  }, [selectedModel, onNewSession]);

  // Session ID changed (either from model reset or Continue from history),
  // or initial mount. Always fetch — new sessions return empty and fall back to INITIAL_MESSAGE.
  React.useEffect(() => {
    setPendingActions([]);
    setDocumentHashWhenSent(null);
    setErrorMessage(null);

    fetchMessages(sessionId)
      .then((persisted) => {
        const mapped = mapMessages(persisted);
        if (mapped.length === 0) {
          setMessages([INITIAL_MESSAGE]);
        } else {
          setMessages(mapped.map((m) => {
            if (m.type === "proposed_changes") {
              return {
                role: "proposed_changes_history",
                content: [{ text: `${m.changeCount} proposed change${m.changeCount !== 1 ? "s" : ""}` }],
              };
            }
            return { role: m.type, content: [{ text: m.text! }] };
          }));
        }
      })
      .catch(() => {
        setMessages([INITIAL_MESSAGE]);
      });
  }, [sessionId, fetchMessages]);

  const handleChatResponse = (data: Record<string, unknown>) => {
    const type = data.type as string;

    if (type === "content") {
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === "assistant" && lastMessage.content) {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              content: [{ text: lastMessage.content[0].text + (data.data as string) }],
            },
          ];
        }
        return [
          ...prev,
          { role: "assistant", content: [{ text: data.data as string }] },
        ];
      });
    } else if (type === "tool_use") {
      setMessages((prev) => [
        ...prev,
        { role: "tool_indicator", tool_name: data.tool_name as string },
      ]);
    } else if (type === "microsoft_actions") {
      setPendingActions((data.actions as Action[]) || []);
    } else if (type === "end_turn") {
      setLoading(false);
    }
  };

  const handleApplyModifications = (appliedIndices: number[], rejectedIndices: number[], failedIndices?: number[], errorMessages?: Record<number, string>, hashMismatch = false) => {
    setMessages((prev) => [
      ...prev,
      {
        role: "action_history",
        actions: pendingActions,
        actedUpon: true,
        appliedIndices,
        rejectedIndices,
        failedIndices: failedIndices || [],
        errorMessages: errorMessages || {},
        hashMismatch,
      },
    ]);
    setPendingActions([]);
  };

  const handleSendMessage = async (inputValue: string) => {
    try {
      // Auto-reject pending actions when user sends a new message
      if (pendingActions.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "action_history",
            actions: pendingActions,
            actedUpon: true,
            rejected: true,
          },
        ]);
        setPendingActions([]);
      }

      const isEmpty = await isDocumentEmpty();
      const documentContent = isEmpty ? "" : await getWordDocumentContent();
      const selectedText = await getSelectedText();

      console.log(documentContent);
      console.log("Selected text:", selectedText);

      const hash = simpleHash(documentContent);
      setDocumentHashWhenSent(hash);

      setMessages((prev) => [
        ...prev,
        { role: "user", content: [{ text: inputValue }] },
      ]);

      setLoading(true);

      await sendMessage(
        sessionId,
        {
          prompt: inputValue,
          word_document: documentContent,
          highlighted: selectedText || "",
          model: selectedModel,
        },
        handleChatResponse
      );
    } catch (err: unknown) {
      setLoading(false);
      const message = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: [{ text: "Error: " + message }] },
      ]);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex justify-end">
        <button
          onClick={onNewSession}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <MessageSquare className="w-3 h-3" />
          New Chat
        </button>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="hover:opacity-70 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <ChatMessageList
        messages={messages}
        loading={loading}
        pendingActions={pendingActions}
        onApplyModifications={handleApplyModifications}
        documentHashWhenSent={documentHashWhenSent}
        onHashMismatch={() => {
          setErrorMessage(
            "Document has changed since your last message. Please send a new message to get updated modifications."
          );
        }}
      />

      <ChatInput onSendMessage={handleSendMessage} disabled={loading} />
    </div>
  );
};

export default ChatInterface;

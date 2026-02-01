import * as React from "react";
import ReactMarkdown from "react-markdown";
import { Wrench } from "lucide-react";
import { cn } from "../lib/utils";
import ModificationReview from "./ModificationReview";

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
  rejected?: boolean;
}

interface ChatMessageListProps {
  messages: Message[];
  loading: boolean;
  pendingActions: Action[];
  onApplyModifications: (appliedIndices: number[], rejectedIndices: number[]) => void;
  documentHashWhenSent: string | null;
  onHashMismatch: () => void;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  loading,
  pendingActions,
  onApplyModifications,
  documentHashWhenSent,
  onHashMismatch,
}) => {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
      {messages.map((msg, index) => (
        <React.Fragment key={index}>
          {/* Tool usage badge */}
          {msg.role === "tool_indicator" && (
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground text-xs px-2.5 py-1 rounded-full font-medium">
                <Wrench className="w-3 h-3" />
                Using {msg.tool_name}
              </span>
            </div>
          )}

          {/* Action history (previously acted-upon modifications) */}
          {msg.role === "action_history" && msg.actions && (
            <ModificationReview
              modifications={msg.actions}
              onApply={() => {}}
              disabled={true}
              appliedIndices={msg.appliedIndices || []}
              rejectedIndices={
                msg.rejectedIndices ||
                (msg.rejected ? msg.actions.map((_, i) => i) : [])
              }
            />
          )}

          {/* Chat bubbles */}
          {(msg.role === "user" || msg.role === "assistant") &&
            msg.content &&
            msg.content[0].text.trim() !== "" && (
              <div className={cn(msg.role === "user" ? "flex justify-end" : "flex justify-start")}>
                <div
                  className={cn(
                    "max-w-[92%] px-3 py-2 rounded-xl text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary text-secondary-foreground rounded-bl-sm"
                  )}
                >
                  {msg.role === "user" ? (
                    msg.content[0].text
                  ) : (
                    <div className="prose prose-sm max-w-none [&>p]:mb-1.5 [&>p:last-child]:mb-0">
                      <ReactMarkdown>{msg.content[0].text}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            )}
        </React.Fragment>
      ))}

      {/* Pending modifications */}
      {pendingActions.length > 0 && (
        <ModificationReview
          modifications={pendingActions}
          onApply={onApplyModifications}
          disabled={false}
          documentHashWhenSent={documentHashWhenSent}
          onHashMismatch={onHashMismatch}
        />
      )}

      {/* Loading indicator */}
      {loading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === "user" && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs italic">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            Generating response...
          </div>
        )}
    </div>
  );
};

export default ChatMessageList;

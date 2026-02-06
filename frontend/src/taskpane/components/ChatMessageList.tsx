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
  tool_input?: Record<string, any>;
  actions?: Action[];
  actedUpon?: boolean;
  appliedIndices?: number[];
  rejectedIndices?: number[];
  failedIndices?: number[];
  errorMessages?: Record<number, string>;
  rejected?: boolean;
  hashMismatch?: boolean;
}

interface ChatMessageListProps {
  messages: Message[];
  loading: boolean;
  pendingActions: Action[];
  onApplyModifications: (appliedIndices: number[], rejectedIndices: number[], failedIndices?: number[], errorMessages?: Record<number, string>) => void;
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
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingActions.length, loading]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-1">
      {messages.map((msg, index) => (
        <React.Fragment key={index}>
          {/* Tool usage badge */}
          {msg.role === "tool_indicator" && (
            <div className="flex justify-center">
              <span className="flex flex-col items-start gap-0.5 bg-accent text-accent-foreground text-xs px-3 py-2 rounded-lg shadow-sm w-[80%]">
                <div className="flex items-center gap-1.5">
                  <Wrench className="w-3 h-3" />
                  <span className="font-semibold">{msg.tool_name}</span>
                </div>
                {msg.tool_input && Object.entries(msg.tool_input).map(([k, v]) => (
                  <div key={k} className="opacity-80">
                    <span className="font-semibold">{k}</span>: {String(v)}
                  </div>
                ))}
              </span>
            </div>
          )}

          {/* Action history */}
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
              failedIndices={msg.failedIndices || []}
              errorMessages={msg.errorMessages || {}}
              expandedByDefault={msg.hashMismatch}
            />
          )}

          {/* Historical proposed changes pill (from continued sessions) */}
          {msg.role === "proposed_changes_history" && msg.content && (
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-1.5 bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
                {msg.content[0].text}
              </div>
            </div>
          )}

          {/* Chat bubbles */}
          {(msg.role === "user" || msg.role === "assistant") &&
            msg.content &&
            msg.content[0].text.trim() !== "" && (
              <div className={cn(msg.role === "user" ? "flex justify-end" : "flex justify-start")}>
                <div
                  className={cn(
                    "max-w-[90%] px-3.5 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm shadow-sm"
                      : "bg-card text-card-foreground rounded-2xl rounded-bl-sm border border-border shadow-sm"
                  )}
                >
                  {msg.role === "user" ? (
                    msg.content[0].text
                  ) : (
                    <div className="[&>p]:mb-1.5 [&>p:last-child]:mb-0 [&>ul]:my-1 [&>ul]:pl-4 [&>ul>li]:list-disc [&>strong]:font-semibold">
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
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm shadow-sm px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

      <div ref={bottomRef} />
    </div>
  );
};

export default ChatMessageList;

import * as React from "react";
import ReactMarkdown from "react-markdown";
import { ChevronRight, MessageSquare } from "lucide-react";
import { cn } from "../lib/utils";
import { useChatAPI, SessionSummary } from "./useChatAPI";
import { mapMessages, RenderedMessage } from "./sessionUtils";

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface HistoryListProps {
  onContinue: (sessionId: string) => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ onContinue }) => {
  const { fetchSessions, fetchMessages } = useChatAPI();
  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedSession, setExpandedSession] = React.useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = React.useState<Record<string, RenderedMessage[]>>({});
  const [loadingMessages, setLoadingMessages] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fetchSessions]);

  const handleToggleSession = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      return;
    }

    setExpandedSession(sessionId);

    // Only fetch if we haven't cached this session's messages yet
    if (sessionMessages[sessionId]) return;

    setLoadingMessages(sessionId);
    try {
      const raw = await fetchMessages(sessionId);
      setSessionMessages((prev) => ({ ...prev, [sessionId]: mapMessages(raw) }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoadingMessages(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Loading history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No past conversations yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pr-1">
      {sessions.map((session) => {
        const isExpanded = expandedSession === session.session_id;
        const messages = sessionMessages[session.session_id];
        const isLoadingThis = loadingMessages === session.session_id;

        return (
          <div key={session.session_id} className="border border-border rounded-lg bg-card overflow-hidden">
            {/* Session header */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-card-foreground/5 transition-colors select-none"
              onClick={() => handleToggleSession(session.session_id)}
            >
              <ChevronRight
                className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-90")}
              />
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 text-xs text-foreground truncate">
                {formatDate(session.created_at)}
              </span>
              <span className="text-xs text-muted-foreground shrink-0 font-mono">
                {session.session_id.slice(0, 8)}
              </span>
            </div>

            {/* Expanded message thread */}
            {isExpanded && (
              <div className="border-t border-border px-3 py-2 flex flex-col gap-2">
                {isLoadingThis && (
                  <div className="text-xs text-muted-foreground py-2">Loading...</div>
                )}

                {messages &&
                  messages.map((msg, i) => (
                    <React.Fragment key={i}>
                      {msg.type === "user" && (
                        <div className="flex justify-end">
                          <div className="max-w-[85%] px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-2xl rounded-br-sm shadow-sm">
                            {msg.text}
                          </div>
                        </div>
                      )}

                      {msg.type === "assistant" && (
                        <div className="flex justify-start">
                          <div className="max-w-[85%] px-3 py-1.5 text-xs bg-card text-card-foreground rounded-2xl rounded-bl-sm border border-border shadow-sm [&>p]:mb-1 [&>p:last-child]:mb-0 [&>ul]:my-1 [&>ul]:pl-4 [&>ul>li]:list-disc [&>strong]:font-semibold">
                            <ReactMarkdown>{msg.text!}</ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {msg.type === "proposed_changes" && (
                        <div className="flex justify-center">
                          <div className="inline-flex items-center gap-1.5 bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
                            {msg.changeCount} proposed change{msg.changeCount !== 1 ? "s" : ""}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}

                {messages && (
                  <div className="pt-1">
                    <button
                      onClick={() => onContinue(session.session_id)}
                      className="w-full text-xs font-medium text-primary hover:text-primary/80 border border-primary rounded-md px-3 py-1.5 transition-colors hover:bg-primary/5"
                    >
                      Continue this conversation
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default HistoryList;

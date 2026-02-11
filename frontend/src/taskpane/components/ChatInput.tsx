import * as React from "react";
import { Send, Wand2 } from "lucide-react";
import { cn } from "../lib/utils";

interface ChatInputProps {
  onSendMessage: (value: string) => void;
  disabled: boolean;
  showPrompts?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled, showPrompts = false }) => {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handlePromptClick = (prompt: string) => {
    setValue(prompt);
    // Focus at the end of the text
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(prompt.length, prompt.length);
      }
    }, 0);
  };

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSendMessage(value);
    setValue("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <>
      {showPrompts && (
        <div className="flex justify-end gap-2 mb-3">
          <div className="flex flex-col gap-2 items-end">
            <button
              onClick={() => handlePromptClick("Add a section about ")}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors border border-primary/20 w-fit"
            >
              <Wand2 className="h-4 w-4" />
              Add a section about
            </button>
            <button
              onClick={() => handlePromptClick("Review this document for ")}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors border border-primary/20 w-fit"
            >
              <Wand2 className="h-4 w-4" />
              Review this document for
            </button>
          </div>
        </div>
      )}
      <div className="shrink-0 bg-card rounded-xl border border-border shadow-sm p-3">
        <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question or request changes..."
          disabled={disabled}
          className={cn(
            "flex-1 resize-none bg-transparent px-1 py-0.5",
            "text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none",
            "disabled:text-muted-foreground disabled:cursor-not-allowed",
            "min-h-[44px] max-h-[140px]"
          )}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 shrink-0",
            canSend
              ? "bg-primary text-primary-foreground hover:bg-primary/85 shadow-sm"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 px-1">
        Enter to send · Shift+Enter for new line
      </p>
      </div>
    </>
  );
};

export default ChatInput;

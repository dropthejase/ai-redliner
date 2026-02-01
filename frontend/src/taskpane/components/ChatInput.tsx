import * as React from "react";
import { Send } from "lucide-react";
import { cn } from "../lib/utils";

interface ChatInputProps {
  onSendMessage: (value: string) => void;
  disabled: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled }) => {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

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
  );
};

export default ChatInput;

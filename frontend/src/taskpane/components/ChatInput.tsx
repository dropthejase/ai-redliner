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
    <div className="flex gap-2 items-end border-t border-border pt-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question or request changes..."
        disabled={disabled}
        className={cn(
          "flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2",
          "text-sm text-foreground placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
          "disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed",
          "min-h-[60px] max-h-[160px]"
        )}
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
          canSend
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
};

export default ChatInput;

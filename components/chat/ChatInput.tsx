import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Smile } from "lucide-react";
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (input.trim() === '' || isLoading) return;
    onSendMessage(input);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="relative">
      <div className="flex items-end gap-2 sm:gap-3 p-3 sm:p-4 bg-card rounded-2xl border border-border shadow-sm backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground transition-colors"
          disabled={isLoading}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className={cn(
              "min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent p-0 text-sm",
              "placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            )}
            disabled={isLoading}
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground transition-colors"
          disabled={isLoading}
        >
          <Smile className="h-4 w-4" />
        </Button>

        <Button
          onClick={handleSend}
          disabled={isLoading || input.trim() === ''}
          size="icon"
          className={cn(
            "h-8 w-8 sm:h-9 sm:w-9 transition-all duration-200 shadow-sm",
            input.trim() !== '' && !isLoading
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 scale-100 shadow-md"
              : "bg-muted text-muted-foreground scale-95"
          )}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex items-center justify-between mt-2 px-2 text-xs text-muted-foreground">
        <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
        <span className="sm:hidden">Tap to send</span>
        <span className={cn(
          "transition-colors",
          input.length > 1800 ? "text-orange-500" : "",
          input.length > 1950 ? "text-red-500" : ""
        )}>{input.length}/2000</span>
      </div>
    </div>
  );
}

export default ChatInput;
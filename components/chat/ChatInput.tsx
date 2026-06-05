'use client';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Smile, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { StreamState } from '@/types';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onStop: () => void;
  streamState: StreamState;
}

const EMOJI_CATEGORIES = {
  Smileys: [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉',
    '😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨',
    '🧐','🤓','😎','🤩','🥳',
  ],
  Gestures: [
    '👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆',
    '🖕','👇','☝️','👏','🙌','👐','🤲','🤝','🙏','✍️','💪','🦾',
  ],
  Hearts: [
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞',
    '💓','💗','💖','💘','💝','💟',
  ],
  Objects: [
    '💻','📱','⌚','📷','🎮','🎧','🎵','🎶','🔥','💯','✨','⭐','🌟',
    '💫','🎉','🎊','🎈','🎁','🏆','🥇',
  ],
};

function ChatInput({ onSendMessage, onStop, streamState }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming =
    streamState === 'thinking' ||
    streamState === 'tool-running' ||
    streamState === 'responding';

  const canSend = input.trim() !== '' && !isStreaming;

  const handleSend = () => {
    if (!canSend) return;
    onSendMessage(input.trim());
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
    // Escape key stops generation
    if (e.key === 'Escape' && isStreaming) {
      onStop();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = input.slice(0, start) + emoji + input.slice(end);
    setInput(newValue);
    setIsEmojiOpen(false);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  return (
    <div className="relative">
      <div className="flex items-end gap-2 sm:gap-3 p-3 sm:p-4 bg-card rounded-2xl border border-border shadow-sm backdrop-blur-sm">
        {/* Attachment button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground transition-colors"
          disabled={isStreaming}
          title="Attach file (coming soon)"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* Text input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? 'Waiting for response… (Esc to stop)'
                : 'Type your message…'
            }
            className={cn(
              'min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent p-0 text-sm',
              'placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0'
            )}
            disabled={false} // allow typing ahead during stream
          />
        </div>

        {/* Emoji picker */}
        <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground transition-colors"
              disabled={isStreaming}
              title="Add emoji"
            >
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" side="top" align="end">
            <div className="max-h-64 overflow-y-auto">
              {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                <div key={category} className="p-3 border-b border-border last:border-b-0">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">{category}</h4>
                  <div className="grid grid-cols-8 gap-1">
                    {emojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="p-1 hover:bg-muted rounded text-lg transition-colors"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Stop / Send button */}
        {isStreaming ? (
          <Button
            onClick={onStop}
            size="icon"
            variant="destructive"
            className={cn(
              'h-8 w-8 sm:h-9 sm:w-9 transition-all duration-200 shadow-sm',
              'animate-in zoom-in-75 duration-150'
            )}
            title="Stop generating (Esc)"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            onClick={handleSend}
            disabled={!canSend}
            size="icon"
            className={cn(
              'h-8 w-8 sm:h-9 sm:w-9 transition-all duration-200 shadow-sm',
              canSend
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 scale-100 shadow-md'
                : 'bg-muted text-muted-foreground scale-95'
            )}
            title="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-between mt-2 px-2 text-xs text-muted-foreground">
        <span className="hidden sm:inline">
          {isStreaming
            ? 'Press Esc to stop generating'
            : 'Enter to send · Shift+Enter for new line'}
        </span>
        <span className="sm:hidden">{isStreaming ? 'Generating…' : 'Tap to send'}</span>
        <span
          className={cn(
            'transition-colors',
            input.length > 1800 ? 'text-orange-500' : '',
            input.length > 1950 ? 'text-red-500' : ''
          )}
        >
          {input.length}/2000
        </span>
      </div>
    </div>
  );
}

export default ChatInput;
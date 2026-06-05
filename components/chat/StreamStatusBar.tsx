'use client';
import { StreamState } from '@/types';
import { cn } from '@/lib/utils';

interface StreamStatusBarProps {
  streamState: StreamState;
  activeToolName?: string;
  characterName: string;
}

const STATE_CONFIG: Record<
  StreamState,
  { label: (char: string, tool?: string) => string; color: string; pulse: boolean; show: boolean }
> = {
  idle: {
    label: () => '',
    color: '',
    pulse: false,
    show: false,
  },
  thinking: {
    label: (char) => `${char} is thinking…`,
    color: 'text-amber-600 dark:text-amber-400',
    pulse: true,
    show: true,
  },
  'tool-running': {
    label: (_char, tool) => `Running tool: ${tool ?? 'unknown'}`,
    color: 'text-blue-600 dark:text-blue-400',
    pulse: true,
    show: true,
  },
  responding: {
    label: (char) => `${char} is responding…`,
    color: 'text-purple-600 dark:text-purple-400',
    pulse: false,
    show: true,
  },
  done: {
    label: () => 'Done',
    color: 'text-green-600 dark:text-green-400',
    pulse: false,
    show: true,
  },
  error: {
    label: () => 'Something went wrong',
    color: 'text-red-600 dark:text-red-400',
    pulse: false,
    show: true,
  },
  cancelled: {
    label: () => 'Stopped',
    color: 'text-muted-foreground',
    pulse: false,
    show: true,
  },
};

const STATE_ICONS: Record<StreamState, string> = {
  idle: '',
  thinking: '💭',
  'tool-running': '🔧',
  responding: '✍️',
  done: '✅',
  error: '⚠️',
  cancelled: '⏹️',
};

export default function StreamStatusBar({
  streamState,
  activeToolName,
  characterName,
}: StreamStatusBarProps) {
  const config = STATE_CONFIG[streamState];

  if (!config.show) return null;

  const label = config.label(characterName, activeToolName);
  const icon = STATE_ICONS[streamState];

  return (
    <div
      className={cn(
        'px-4 pb-2 flex items-center gap-2 text-xs font-medium transition-all duration-300',
        'animate-in slide-in-from-top-1',
        config.color
      )}
      aria-live="polite"
      aria-label={`Stream status: ${label}`}
    >
      {/* Dots for pulse states */}
      {config.pulse ? (
        <div className="flex gap-0.5 items-center">
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full bg-current animate-bounce',
            )}
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
            style={{ animationDelay: '120ms' }}
          />
          <div
            className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
            style={{ animationDelay: '240ms' }}
          />
        </div>
      ) : (
        <span className="text-sm leading-none">{icon}</span>
      )}
      <span>{label}</span>
    </div>
  );
}

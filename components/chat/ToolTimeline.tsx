'use client';
import { useState } from 'react';
import { ToolCallRecord } from '@/types';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Wrench, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ToolTimelineProps {
  toolCalls: ToolCallRecord[];
}

function ToolCallItem({ call }: { call: ToolCallRecord }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    pending: <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />,
    success: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
    error: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  }[call.status];

  const statusColor = {
    pending: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30',
    success: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30',
    error: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
  }[call.status];

  return (
    <div
      className={cn(
        'rounded-xl border text-xs transition-all duration-200',
        statusColor
      )}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        {statusIcon}
        <Wrench className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono font-semibold flex-1 truncate">{call.name}</span>
        {call.durationMs !== undefined && (
          <span className="text-muted-foreground tabular-nums">
            {call.durationMs}ms
          </span>
        )}
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-current/10">
          <div>
            <p className="text-muted-foreground font-medium mt-2 mb-1">Args</p>
            <pre className="font-mono bg-background/60 rounded-lg p-2 overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(call.args, null, 2)}
            </pre>
          </div>
          {call.result !== undefined && (
            <div>
              <p className="text-muted-foreground font-medium mb-1">Result</p>
              <pre className="font-mono bg-background/60 rounded-lg p-2 overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap break-all">
                {JSON.stringify(call.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ToolTimeline({ toolCalls }: ToolTimelineProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="mx-2 mb-2 space-y-1.5">
      <p className="text-xs text-muted-foreground font-medium px-1 flex items-center gap-1.5">
        <Wrench className="h-3 w-3" />
        Tools used this turn
      </p>
      {toolCalls.map((call) => (
        <ToolCallItem key={call.callId} call={call} />
      ))}
    </div>
  );
}

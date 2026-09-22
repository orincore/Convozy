'use client';

import { useEffect, useState } from 'react';
import {
  CircleNotch,
  WarningCircle,
  ClockCounterClockwise,
  CheckCircle,
  XCircle,
  Hourglass,
  Prohibit,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { activityApi, ActivityEvent, ApiError, CommentEventStatus, MessageLogStatus } from '@/lib/api';

const EVENT_STATUS_LABEL: Record<CommentEventStatus, string> = {
  PENDING: 'Pending',
  MATCHED: 'Matched',
  NO_MATCH: 'No match',
  PROCESSED: 'Processed',
  FAILED: 'Failed',
};

function EventStatusBadge({ status }: { status: CommentEventStatus }) {
  const tone =
    status === 'MATCHED' || status === 'PROCESSED'
      ? 'text-success'
      : status === 'FAILED'
        ? 'text-danger'
        : 'text-muted-foreground';
  return <span className={`text-xs font-medium ${tone}`}>{EVENT_STATUS_LABEL[status]}</span>;
}

const MESSAGE_STATUS_ICON: Record<MessageLogStatus, typeof CheckCircle> = {
  SENT: CheckCircle,
  QUEUED: Hourglass,
  FAILED: XCircle,
  RATE_LIMITED: Prohibit,
  DEAD_LETTERED: XCircle,
};

function MessageLogRow({ log }: { log: ActivityEvent['messageLogs'][number] }) {
  const Icon = MESSAGE_STATUS_ICON[log.status];
  const tone =
    log.status === 'SENT' ? 'text-success' : log.status === 'QUEUED' ? 'text-muted-foreground' : 'text-danger';
  return (
    <div className={`flex items-center gap-1.5 text-xs ${tone}`}>
      <Icon size={13} weight="bold" />
      <span>
        {log.actionType === 'SEND_DM' ? 'DM' : log.actionType === 'REPLY_COMMENT' ? 'Reply' : 'AI reply'}
        {log.status === 'SENT' ? ' sent' : log.status === 'QUEUED' ? ' queued' : ` ${log.status.toLowerCase().replace('_', ' ')}`}
      </span>
    </div>
  );
}

function EventRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">
            <span className="font-medium">@{event.fromUsername}</span>{' '}
            <span className="text-muted-foreground">commented on @{event.instagramAccount.igUsername}</span>
          </p>
          <p className="mt-1 truncate text-sm text-muted-foreground">&ldquo;{event.text}&rdquo;</p>
        </div>
        <EventStatusBadge status={event.status} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {event.matchedAutomation && (
          <span className="text-xs text-muted-foreground">Matched &ldquo;{event.matchedAutomation.name}&rdquo;</span>
        )}
        {event.messageLogs.map((log) => (
          <MessageLogRow key={log.id} log={log} />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
        <ClockCounterClockwise size={24} weight="bold" className="text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">No activity yet</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Comments on your connected posts will show up here as they come in.
        </p>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    activityApi
      .list()
      .then(setEvents)
      .catch((err: ApiError) => setError(err.message));
  }

  useEffect(load, []);

  if (events === null && !error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <CircleNotch size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && events === null) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <WarningCircle size={24} className="text-danger" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  if (events && events.length === 0) {
    return <EmptyState />;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Activity</h1>

      <div className="mt-6 flex flex-col divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
        {events?.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

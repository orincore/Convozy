'use client';

import { useEffect, useRef, useState } from 'react';
import { ACCOUNT_HEADER, getSelectedAccountId } from './account';
import { API_BASE_URL, refreshAccessToken } from './api';
import { getAccessToken } from './auth';

export interface TicketStreamEvent {
  type: 'ticket';
  ticketId: string;
  reason: 'created' | 'message' | 'updated' | 'reply' | 'note';
}

export type StreamStatus = 'connecting' | 'live' | 'offline';

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

/** Pulls complete `data:` events out of an SSE text buffer; returns the parsed events and the unfinished remainder. */
export function parseSse(buffer: string): { events: unknown[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: unknown[] = [];
  for (const part of parts) {
    const data = part
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      // Ignore malformed events.
    }
  }
  return { events, rest };
}

/**
 * Live ticket updates for the selected Instagram account, over Server-Sent Events.
 * fetch is used instead of EventSource so the Authorization header can be sent. The
 * connection reconnects with backoff and refreshes an expired token; `onEvent`
 * should refetch, since events carry only ids.
 */
export function useTicketStream(onEvent: (event: TicketStreamEvent) => void): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    let delay = MIN_DELAY_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function connect(isRetryAfterRefresh = false): Promise<void> {
      controller = new AbortController();
      try {
        const accountId = getSelectedAccountId();
        const res = await fetch(`${API_BASE_URL}/tickets/stream`, {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            Accept: 'text/event-stream',
            ...(accountId ? { [ACCOUNT_HEADER]: accountId } : {}),
          },
          signal: controller.signal,
        });
        if (res.status === 401 && !isRetryAfterRefresh && (await refreshAccessToken())) return connect(true);
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSse(buffer);
          buffer = parsed.rest;
          for (const event of parsed.events as { type?: string }[]) {
            if (event.type === 'ready') {
              delay = MIN_DELAY_MS;
              setStatus('live');
            } else if (event.type === 'ticket') {
              handler.current(event as TicketStreamEvent);
            }
          }
        }
      } catch {
        // Fall through to reconnect (also reached on abort when unmounting).
      }
      if (cancelled) return;
      setStatus('offline');
      timer = setTimeout(() => void connect(), delay);
      delay = Math.min(delay * 2, MAX_DELAY_MS);
    }

    void connect();
    return () => {
      cancelled = true;
      controller?.abort();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return status;
}

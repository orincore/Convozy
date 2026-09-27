import type { Icon } from '@phosphor-icons/react';
import {
  ArrowBendDownRight,
  ChatCircleDots,
  CheckCircle,
  Circle,
  Clock,
  Link as LinkIcon,
  LockSimple,
  Megaphone,
  Tag,
  Timer,
} from '@phosphor-icons/react';
import { StatusPill, type PillTone } from '@/components/dashboard/status-pill';
import type { TicketPriority, TicketSource, TicketStatus } from '@/lib/api';

export const STATUS_META: Record<TicketStatus, { label: string; tone: PillTone; icon: Icon }> = {
  OPEN: { label: 'Open', tone: 'warning', icon: Circle },
  IN_PROGRESS: { label: 'In progress', tone: 'neutral', icon: Timer },
  WAITING: { label: 'Waiting on customer', tone: 'neutral', icon: Clock },
  RESOLVED: { label: 'Resolved', tone: 'success', icon: CheckCircle },
  CLOSED: { label: 'Closed', tone: 'neutral', icon: LockSimple },
};

export const STATUS_ORDER: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'];

export const PRIORITY_META: Record<TicketPriority, { label: string; tone: PillTone }> = {
  URGENT: { label: 'Urgent', tone: 'danger' },
  HIGH: { label: 'High', tone: 'danger' },
  NORMAL: { label: 'Normal', tone: 'neutral' },
  LOW: { label: 'Low', tone: 'neutral' },
};

export const PRIORITY_ORDER: TicketPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

export const SOURCE_META: Record<TicketSource, { label: string; icon: Icon }> = {
  COMMENT: { label: 'Comment', icon: ChatCircleDots },
  DM: { label: 'Direct message', icon: ArrowBendDownRight },
  STORY_MENTION: { label: 'Story mention', icon: Megaphone },
  REFERRAL: { label: 'ig.me link', icon: LinkIcon },
  TAGGED_POST: { label: 'Tagged post', icon: Tag },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const m = STATUS_META[status];
  return <StatusPill label={m.label} tone={m.tone} icon={m.icon} />;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const m = PRIORITY_META[priority];
  return <StatusPill label={m.label} tone={m.tone} />;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Prefer the resolved real name over the raw @username, over "Unknown" —
 * see TicketParticipant.name's comment in lib/api.ts for why a DM/story-
 * mention/referral participant often has no username at all. */
export function participantLabel(p: { username: string | null; name?: string | null }, fallback = 'Unknown'): string {
  if (p.name) return p.name;
  if (p.username) return `@${p.username}`;
  return fallback;
}

export function initials(name: string | null | undefined, fallback = '?'): string {
  const source = (name ?? '').trim();
  if (!source) return fallback;
  const parts = source.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? fallback).toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? '');
}

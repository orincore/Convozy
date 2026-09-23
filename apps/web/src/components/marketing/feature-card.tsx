'use client';

import type { ComponentType } from 'react';
import { SpotlightCard } from './spotlight-card';
import type { Feature } from '@/lib/features';
import * as V from './feature-visuals';

const VISUALS: Record<string, ComponentType> = {
  'comment-to-dm': V.CommentDmVisual,
  'story-replies': V.StoryReplyVisual,
  'live-comments': V.LiveCommentVisual,
  'post-scope': V.PostScopeVisual,
  branches: V.BranchVisual,
  'contacts-tags': V.ContactsTagsVisual,
  segments: V.SegmentsVisual,
  templates: V.TemplatesVisual,
  moderation: V.ModerationVisual,
  buttons: V.ButtonsVisual,
  personalize: V.MergeTagVisual,
  timed: V.TimedRepliesVisual,
  sequences: V.SequenceVisual,
  broadcasts: V.BroadcastVisual,
  analytics: V.AnalyticsVisual,
  ai: V.AiVisual,
  inbox: V.InboxVisual,
  requests: V.RequestVisual,
  growth: V.GrowthVisual,
};

/** One feature: an animated example on top, the name and one plain sentence below. */
export function FeatureCard({ feature }: { feature: Feature }) {
  const Visual = VISUALS[feature.id];
  return (
    <SpotlightCard className="flex h-full flex-col gap-5 rounded-3xl bg-card p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
      {Visual && <Visual />}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold tracking-tight">{feature.title}</h3>
          {feature.status === 'soon' && (
            <span className="max-w-[58%] shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-right text-[0.6875rem] leading-tight text-muted-foreground">
              {feature.joke ?? 'Coming soon'}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
      </div>
    </SpotlightCard>
  );
}

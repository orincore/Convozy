import { ActionType, TriggerMatchType, TriggerSource } from '@prisma/client';

// Same shape as CreateAutomationDto's triggers/actions arrays, minus
// workspace/account-specific fields — TemplatesService.install() deserializes
// these straight into a real CreateAutomationDto. Every template's message
// text is a genuinely usable starting point, not a placeholder that silently
// does nothing — creators review/edit before the form actually submits (the
// frontend pre-fills the builder for review, it doesn't blind-install).
export interface SeedTemplate {
  slug: string;
  name: string;
  description: string;
  triggers: Array<{
    source: TriggerSource;
    matchType: TriggerMatchType;
    keywords: string[];
    caseSensitive?: boolean;
  }>;
  actions: Array<{
    type: ActionType;
    order?: number;
    delaySeconds?: number;
    payload: { text: string };
  }>;
}

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    slug: 'reply-link-dm',
    name: 'Comment LINK → DM the link',
    description: 'Someone comments "link" and gets a DM with whatever you\'re promoting.',
    triggers: [{ source: TriggerSource.COMMENT, matchType: TriggerMatchType.CONTAINS, keywords: ['link'] }],
    actions: [
      {
        type: ActionType.SEND_DM,
        payload: { text: "Hey {{username}}! Here's the link 🔗 [add your link here]" },
      },
    ],
  },
  {
    slug: 'pricing-dm',
    name: 'Comment PRICE → DM the price list',
    description: 'Someone asks about pricing in the comments and gets your pricing sent automatically.',
    triggers: [
      { source: TriggerSource.COMMENT, matchType: TriggerMatchType.CONTAINS, keywords: ['price', 'pricing'] },
    ],
    actions: [
      {
        type: ActionType.SEND_DM,
        payload: { text: 'Hey {{username}}! Thanks for asking 💜 Here are the details: [add your pricing info here]' },
      },
    ],
  },
  {
    slug: 'faq-freebie',
    name: 'Comment FREEBIE → DM a free download',
    description: 'A simple lead-magnet flow — comment a keyword, get a free resource by DM.',
    triggers: [{ source: TriggerSource.COMMENT, matchType: TriggerMatchType.CONTAINS, keywords: ['freebie'] }],
    actions: [
      {
        type: ActionType.SEND_DM,
        payload: { text: 'Hey {{username}}! Here\'s your free download 🎁 [add your freebie link here]' },
      },
    ],
  },
  {
    slug: 'story-reply-thanks',
    name: 'Story reply → thank-you DM',
    description: 'Anyone who replies to your story gets an automatic thank-you.',
    triggers: [{ source: TriggerSource.STORY_REPLY, matchType: TriggerMatchType.CONTAINS, keywords: [] }],
    actions: [
      { type: ActionType.SEND_DM, payload: { text: 'Thanks so much for replying to my story, {{username}}! 💜' } },
    ],
  },
  {
    slug: 'live-comment-welcome',
    name: 'Live comment → public welcome',
    description: 'Welcome every commenter during a live video with a public reply.',
    triggers: [{ source: TriggerSource.LIVE_COMMENT, matchType: TriggerMatchType.CONTAINS, keywords: [] }],
    actions: [{ type: ActionType.REPLY_COMMENT, payload: { text: 'Welcome to the live, {{username}}! 👋' } }],
  },
];

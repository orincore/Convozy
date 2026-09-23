export type FeatureStatus = 'live' | 'soon';

export interface Feature {
  id: string;
  title: string;
  body: string;
  status: FeatureStatus;
  /** Funny stand-in for the "Coming soon" badge text, on planned features only. */
  joke?: string;
}

/**
 * Marketing list of features. `live` means it is built and working in the
 * dashboard today (see TRACKER.md); `soon` means planned and not built yet.
 * Everything live is on the Free plan: the Free plan is bootstrapped with
 * every feature key switched on (billing/entitlements).
 */
export const FEATURES: Feature[] = [
  { id: 'comment-to-dm', status: 'live', title: 'Comment to DM', body: 'Someone comments your keyword and gets your DM straight away.' },
  { id: 'story-replies', status: 'live', title: 'Story replies', body: 'Someone replies to your Story and gets your answer right away.' },
  { id: 'live-comments', status: 'live', title: 'Live comments', body: 'Answer keyword comments while you are live, without touching your phone.' },
  { id: 'post-scope', status: 'live', title: 'Pick your posts', body: 'Run an automation on one post, a few of them, or everything you post.' },
  { id: 'branches', status: 'live', title: 'If this, then that', body: 'Send different replies depending on what someone did, like following you.' },
  { id: 'contacts-tags', status: 'live', title: 'Contacts and tags', body: 'Everyone who talks to you is saved. Tag them as Lead, Buyer or VIP.' },
  { id: 'segments', status: 'live', title: 'Groups of people', body: 'Build groups from tags and details, and reuse them anywhere.' },
  { id: 'templates', status: 'live', title: 'Ready-made templates', body: 'Start from a template like "Send my freebie" and be live in minutes.' },
  { id: 'moderation', status: 'live', title: 'Hide unwanted comments', body: 'Spam and comments you do not want get hidden automatically.' },
  { id: 'buttons', status: 'live', title: 'Buttons and follow first', body: 'Add tap buttons to your DMs and ask people to follow before they get the link.' },
  { id: 'personalize', status: 'live', title: 'Personal messages', body: 'Add their name and details so every DM feels one to one.' },
  { id: 'timed', status: 'live', title: 'Timed replies', body: 'Send more than one message, with a wait in between.' },

  { id: 'sequences', status: 'soon', joke: 'Coming soon, like your ex\'s apology', title: 'Drip sequences', body: 'A series of messages sent over days after someone signs up.' },
  { id: 'broadcasts', status: 'soon', joke: 'Coming soon, like a text from your crush', title: 'Broadcasts', body: 'Send one message to a whole group of people at once.' },
  { id: 'analytics', status: 'soon', joke: 'Coming soon, like a proposal', title: 'Results at a glance', body: 'See how many DMs went out and which automations work best.' },
  { id: 'ai', status: 'soon', joke: 'Coming soon, listens better than your ex', title: 'AI replies', body: 'Optional replies written in your style. Off unless you turn it on.' },
  { id: 'inbox', status: 'soon', joke: 'Coming soon, like \"be there in 5\"', title: 'Take over the chat', body: 'Jump into any conversation yourself, then hand it back to the automation.' },
  { id: 'requests', status: 'soon', joke: 'Coming soon, like meeting the parents', title: 'Connect your own tools', body: 'Let an automation ask your own tools for info, like today\'s price.' },
  { id: 'growth', status: 'soon', joke: 'Coming soon, like commitment', title: 'Links and QR codes', body: 'A link or QR code that opens Instagram and starts a chat.' },
];

/**
 * Loose types for Meta's webhook payload shape. Meta's exact field names for
 * Instagram comments/messaging webhooks should be re-verified against
 * current Graph API docs before Phase 1 implementation (see TRACKER.md
 * "Risks" — Meta changes these periodically). Intentionally not a strict
 * class-validator DTO: the payload shape varies by subscribed field and we
 * only need to safely extract what we act on, not validate the whole thing.
 */
export interface MetaWebhookPayload {
  object: string; // "instagram"
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string; // IG business account ID
  time: number;
  changes?: MetaWebhookChange[]; // comments, mentions
  messaging?: MetaMessagingEvent[]; // DMs
}

export interface MetaWebhookChange {
  field: string; // "comments", "mentions", "live_comments"
  value: {
    id: string; // comment ID — used as externalEventId
    text?: string;
    from?: { id: string; username: string };
    media?: { id: string };
  };
}

export interface MetaMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    // Present only when this message is a reply to something. `story`
    // distinguishes a story reply from a plain DM (which has no reply_to,
    // or a reply_to.mid pointing at an earlier message) — confirmed against
    // Meta's documented Messenger-platform-style reply_to shape, which
    // Instagram messaging inherits, since Meta's own Instagram-specific
    // webhook docs didn't spell this out directly.
    reply_to?: { story?: { id: string; url: string } };
  };
  // Present when the sender tapped a postback-type button on a Button
  // Template message (see messaging.service.ts's sendButtonTemplate) —
  // requires the app be subscribed to the messaging_postbacks webhook field
  // (see InstagramService.WEBHOOK_SUBSCRIBED_FIELDS). Confirmed shape
  // against Meta's current Instagram-Login webhook examples doc.
  postback?: {
    mid: string;
    title: string;
    payload: string;
  };
}

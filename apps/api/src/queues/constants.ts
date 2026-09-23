/**
 * Queue names. Every queue needs bounded retries + a DLQ per CLAUDE.md §6 —
 * see queue.module.ts for the shared default job options that enforce this.
 */
export enum QueueName {
  WEBHOOK_EVENTS = 'webhook-events',
  AUTOMATION_MATCH = 'automation-match',
  MESSAGE_SEND = 'message-send',
  AI_PROCESSING = 'ai-processing',
  BILLING_EVENTS = 'billing-events',
  TOKEN_REFRESH = 'token-refresh',
  POSTBACK_EVENTS = 'postback-events',
}

export function deadLetterQueueName(queue: QueueName): string {
  return `${queue}-dlq`;
}

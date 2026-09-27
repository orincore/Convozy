import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { AppConfig } from '../../config/configuration';
import { EMAIL_SENDERS, EmailSenderKind } from './email-senders';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Which verified alias this mail stream sends from. See email-senders.ts. */
  from: EmailSenderKind;
  replyTo?: string;
}

/**
 * Thin wrapper over AWS SES v2 — every outbound transactional/marketing
 * email in the app goes through here rather than a module constructing its
 * own SES client, so the sender-alias map and configuration set stay in one
 * place. Mirrors MediaService's "unconfigured -> no-op, log it" pattern
 * (CLAUDE.md §13: optional integrations degrade rather than crash the boot).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: SESv2Client | null;
  private readonly configurationSet?: string;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const email = this.configService.get('email', { infer: true });
    this.configurationSet = email.sesConfigurationSet;
    this.client =
      email.awsRegion && email.awsAccessKeyId && email.awsSecretAccessKey
        ? new SESv2Client({
            region: email.awsRegion,
            credentials: {
              accessKeyId: email.awsAccessKeyId,
              secretAccessKey: email.awsSecretAccessKey,
            },
          })
        : null;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Best-effort by design: callers that have a working fallback for the
   * recipient (e.g. a copyable invite link) should not fail their own
   * operation just because mail delivery hiccupped — catch this and log,
   * don't let it propagate past a request that has other ways to succeed.
   * Callers with no fallback (e.g. a future "forgot password" flow) should
   * let the rejection propagate instead.
   */
  async send(input: SendEmailInput): Promise<void> {
    if (!this.client) {
      this.logger.warn(`Email not sent (SES not configured): "${input.subject}" to ${describe(input.to)}`);
      return;
    }

    const destination = Array.isArray(input.to) ? input.to : [input.to];

    try {
      await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: EMAIL_SENDERS[input.from],
          Destination: { ToAddresses: destination },
          ReplyToAddresses: input.replyTo ? [input.replyTo] : undefined,
          ConfigurationSetName: this.configurationSet,
          Content: {
            Simple: {
              Subject: { Data: input.subject, Charset: 'UTF-8' },
              Body: {
                Html: { Data: input.html, Charset: 'UTF-8' },
                ...(input.text ? { Text: { Data: input.text, Charset: 'UTF-8' } } : {}),
              },
            },
          },
        }),
      );
    } catch (err) {
      // Never log recipient PII beyond what's needed to correlate the
      // failure (CLAUDE.md §5/§9a A09) — no full body/subject content here.
      this.logger.error(`SES send failed for "${input.subject}" to ${describe(input.to)}: ${(err as Error).message}`);
      throw err;
    }
  }
}

function describe(to: string | string[]): string {
  const list = Array.isArray(to) ? to : [to];
  return list.map((addr) => addr.replace(/^(.).*(@.*)$/, '$1***$2')).join(', ');
}

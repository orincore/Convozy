/**
 * Shared transactional-email shell: circular brand mark, one heading, body
 * copy, an optional single CTA button. Table-based layout with every style
 * inlined - email clients (Outlook in particular) don't reliably support
 * flexbox/grid or a linked stylesheet, so this can't reuse the web app's
 * Tailwind setup. Monochrome black/white to match the locked brand (CLAUDE.md
 * §12a) - the button reuses the same inverted white-on-black treatment the
 * dashboard uses for primary actions.
 */
export interface EmailLayoutInput {
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  /** Preview text shown next to the subject in inbox lists; kept out of the visible body. */
  preheader?: string;
}

const LOGO_URL = 'https://convozy.orincore.com/brand/email-avatar.png';

export function renderEmailHtml(input: EmailLayoutInput): string {
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>`
    : '';

  const cta = input.cta
    ? `
      <tr>
        <td align="center" style="padding:8px 0 4px;">
          <a href="${input.cta.url}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">
            ${escapeHtml(input.cta.label)}
          </a>
        </td>
      </tr>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    ${preheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:32px 32px 8px;">
                <img src="${LOGO_URL}" width="48" height="48" alt="Convozy" style="display:block;border-radius:50%;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 32px 0;">
                <h1 style="margin:0;font-size:20px;line-height:1.3;font-weight:600;color:#0a0a0a;">${escapeHtml(input.heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px;font-size:14px;line-height:1.6;color:#3f3f46;">
                ${input.bodyHtml}
              </td>
            </tr>
            ${cta}
            <tr>
              <td style="padding:24px 32px 32px;border-top:1px solid #f0f0f0;margin-top:16px;">
                <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#a1a1aa;">Convozy &middot; Instagram comment-to-DM automation</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

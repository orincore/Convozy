/**
 * Which connected Instagram account the dashboard is working on. Every
 * account keeps its own automations, contacts, tickets and settings, so the
 * selection is sent with each API call (X-Instagram-Account-Id) and validated
 * on the server against the signed-in workspace. Stored in localStorage only
 * as a convenience; the server never trusts it.
 */
const KEY = 'convozy_selected_account';

export const ACCOUNT_HEADER = 'X-Instagram-Account-Id';

export function getSelectedAccountId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setSelectedAccountId(id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // Private windows can block storage; the in-memory selection still works.
  }
}

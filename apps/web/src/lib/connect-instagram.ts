import { instagramApi } from './api';

export const CONNECT_MESSAGE_TYPE = 'convozy:instagram-connect';

export interface ConnectResult {
  status: 'connected' | 'error' | 'closed';
  message?: string;
}

/**
 * Connects an Instagram account in a popup window. The authorize URL asks
 * Instagram to always show its login screen (force_reauth), so a different
 * account than the browser's current one can be chosen. Resolves when the
 * popup reports back or is closed. Falls back to a full-page redirect if the
 * browser blocks the popup.
 */
export async function connectInstagramAccount(): Promise<ConnectResult> {
  const { url } = await instagramApi.startOAuth();

  const width = 520;
  const height = 760;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  const popup = window.open(url, 'convozy-instagram-connect', `popup=yes,width=${width},height=${height},left=${left},top=${top}`);

  if (!popup) {
    window.location.href = url;
    return new Promise(() => undefined);
  }

  return new Promise<ConnectResult>((resolve) => {
    let settled = false;
    const finish = (result: ConnectResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      window.clearInterval(timer);
      resolve(result);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== CONNECT_MESSAGE_TYPE) return;
      finish({ status: event.data.status, message: event.data.message });
    };
    window.addEventListener('message', onMessage);
    // The person may close the popup without finishing.
    const timer = window.setInterval(() => {
      if (popup.closed) finish({ status: 'closed' });
    }, 500);
  });
}

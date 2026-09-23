'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, DownloadSimple, Link as LinkIcon, ShareNetwork, WarningCircle } from '@phosphor-icons/react';

/**
 * Share a generated Comment Art image through the phone's native share sheet
 * (Instagram, Messages, etc.) with the Web Share API.
 *
 * Things that must hold for this to work:
 * - Secure context: navigator.share only exists on HTTPS (or localhost).
 * - It must be called straight from a tap. iOS Safari rejects it if we await
 *   a network request first, so the image is downloaded on mount and the tap
 *   handler calls share() synchronously.
 * - Instagram takes the image from the share sheet but ignores any text or
 *   link, so the link is baked into the image ("Created by Convozy") and also
 *   copied to the clipboard for pasting into a Story link sticker.
 * - In-app browsers (Instagram, Facebook, TikTok...) block file sharing, so
 *   they get the download and copy-link fallback instead.
 */

interface Props {
  artId: string;
  imageUrl: string;
}

type Phase = 'preparing' | 'ready' | 'sharing' | 'shared' | 'failed';

const IN_APP_BROWSER = /FBAN|FBAV|Instagram|TikTok|musical_ly|Line\/|Snapchat|Twitter/i;

function makeFile(blob: Blob, artId: string): File {
  const type = blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  const ext = type === 'image/jpeg' ? 'jpg' : 'png';
  return new File([blob], `convozy-comment-art-${artId}.${ext}`, { type });
}

export function InstagramShareButton({ artId, imageUrl }: Props) {
  const [phase, setPhase] = useState<Phase>('preparing');
  const [canShareFile, setCanShareFile] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const linkRef = useRef('');

  useEffect(() => {
    linkRef.current = `${window.location.origin}/art/${artId}`;
    let cancelled = false;
    let created: string | null = null;
    (async () => {
      try {
        setInApp(IN_APP_BROWSER.test(navigator.userAgent));
        const res = await fetch(imageUrl, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`Image request failed (${res.status})`);
        const file = makeFile(await res.blob(), artId);
        if (cancelled) return;
        fileRef.current = file;
        created = URL.createObjectURL(file);
        setObjectUrl(created);
        setCanShareFile(
          typeof navigator.share === 'function' &&
            typeof navigator.canShare === 'function' &&
            navigator.canShare({ files: [file] }),
        );
        setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        setMessage(err instanceof Error ? err.message : 'Could not load the image.');
        setPhase('failed');
      }
    })();

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [artId, imageUrl]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(linkRef.current);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this link', linkRef.current);
    }
  }, []);

  const share = useCallback(() => {
    const file = fileRef.current;
    if (!file || phase === 'sharing') return;
    setMessage(null);
    setPhase('sharing');

    const text = `Created by Convozy. ${linkRef.current}`;
    // Fire before share() while the tap is still fresh; ignore failures.
    void navigator.clipboard?.writeText(linkRef.current).catch(() => undefined);

    navigator
      .share({ files: [file], title: 'Created by Convozy', text })
      .then(() => setPhase('shared'))
      .catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'AbortError') {
          setPhase('ready');
          return;
        }
        setMessage(
          name === 'NotAllowedError'
            ? 'Your browser blocked sharing. Use the download option below.'
            : 'Sharing did not work on this device. Use the download option below.',
        );
        setCanShareFile(false);
        setPhase('ready');
      });
  }, [phase]);

  const useNative = canShareFile && !inApp;

  return (
    <div className="w-full max-w-sm">
      <AnimatePresence mode="wait" initial={false}>
        {useNative ? (
          <motion.div key="native" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <button
              type="button"
              onClick={share}
              disabled={phase === 'preparing' || phase === 'sharing'}
              className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-accent text-base font-medium text-accent-foreground transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:opacity-60"
            >
              {phase === 'sharing' ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground" />
                  Opening share sheet...
                </>
              ) : (
                <>
                  <ShareNetwork size={20} weight="bold" />
                  Share to Instagram
                </>
              )}
            </button>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Pick Instagram, then Stories. The link to Convozy is copied for you to paste as a link sticker.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="fallback"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl bg-white/[0.04] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
          >
            <p className="text-sm font-medium">
              {phase === 'preparing' ? 'Getting your image ready...' : 'Save it, then post it to Instagram'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {inApp
                ? 'This in-app browser blocks sharing. Open this page in Safari or Chrome for the share button, or save the image here.'
                : 'Sharing from this browser is not available, so download the image and add it to your Story yourself.'}
            </p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <a
                href={objectUrl ?? imageUrl}
                download={`convozy-comment-art-${artId}.png`}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-sm font-medium text-accent-foreground transition-transform active:scale-[0.98]"
              >
                <DownloadSimple size={18} weight="bold" />
                Download image
              </a>
              <button
                type="button"
                onClick={copyLink}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-white/10 text-sm font-medium transition-transform active:scale-[0.98]"
              >
                {copied ? <CheckCircle size={18} weight="fill" className="text-success" /> : <LinkIcon size={18} weight="bold" />}
                {copied ? 'Link copied' : 'Copy link'}
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              On iPhone you can also press and hold the picture and choose Save to Photos.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div aria-live="polite" className="mt-3 min-h-5 text-center text-sm">
        {phase === 'shared' && (
          <span className="inline-flex items-center gap-1.5 text-success">
            <CheckCircle size={16} weight="fill" /> Shared. Link copied too.
          </span>
        )}
        {message && (
          <span className="inline-flex items-center gap-1.5 text-danger">
            <WarningCircle size={16} weight="fill" /> {message}
          </span>
        )}
      </div>
    </div>
  );
}

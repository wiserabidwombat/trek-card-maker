import { useCallback, useEffect, useState } from 'react';

/** Chromium's install event; not in lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Offers the browser's "install this app" prompt when the browser has one to offer: `canInstall`
 * turns on once the event fires and off again after the prompt is answered or the app is installed.
 */
export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const [pending, setPending] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPending(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPending(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!pending) return;
    await pending.prompt();
    try {
      await pending.userChoice;
    } finally {
      setPending(null);
    }
  }, [pending]);

  return { canInstall: pending !== null, install };
}

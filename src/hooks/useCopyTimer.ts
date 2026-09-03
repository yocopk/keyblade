// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { useCallback, useEffect, useRef, useState } from "react";

/** How long a copied secret is allowed to sit in the clipboard. */
export const CLIPBOARD_SECONDS = 20;

/**
 * Tracks which field was copied and how long is left before the clipboard is
 * cleared.
 *
 * The countdown is the visible half of a promise the Rust side keeps: the real
 * clearing, and the flags that keep the value out of Windows Clipboard History
 * and cloud sync, land with the vault in M1. This hook exists now so the
 * interface is already shaped around a clipboard that expires, rather than
 * having the idea retrofitted.
 */
export function useCopyTimer() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  const copy = useCallback((key: string) => {
    setCopiedKey(key);
    setSecondsLeft(CLIPBOARD_SECONDS);
  }, []);

  useEffect(() => {
    if (copiedKey === null) return;

    timer.current = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          setCopiedKey(null);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer.current);
  }, [copiedKey]);

  const reset = useCallback(() => {
    setCopiedKey(null);
    setSecondsLeft(0);
  }, []);

  return { copiedKey, secondsLeft, copy, reset };
}

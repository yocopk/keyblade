// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Counts down to an automatic lock, and gives the caller a way to reset it.
 *
 * Locking must not depend on anyone remembering to lock. This is the idle half
 * of that; the rest — Windows session lock, suspend, hibernate — arrives in M1,
 * where the application process can subscribe to them.
 *
 * A limit of zero means never.
 */
export function useAutoLock(limitSeconds: number, onExpire: () => void, active: boolean) {
  const [remaining, setRemaining] = useState(limitSeconds);
  // Held in a ref so a new callback each render does not restart the interval.
  const expire = useRef(onExpire);
  expire.current = onExpire;

  const touch = useCallback(() => setRemaining(limitSeconds), [limitSeconds]);

  useEffect(() => setRemaining(limitSeconds), [limitSeconds]);

  useEffect(() => {
    if (!active || limitSeconds === 0) return;

    const tick = window.setInterval(() => {
      setRemaining((previous) => {
        if (previous <= 1) {
          expire.current();
          return limitSeconds;
        }
        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(tick);
  }, [active, limitSeconds]);

  return { remaining, touch };
}

/** Formats the countdown as mm:ss, with the digits aligned. */
export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes < 10 ? "0" : ""}${minutes}:${rest < 10 ? "0" : ""}${rest}`;
}

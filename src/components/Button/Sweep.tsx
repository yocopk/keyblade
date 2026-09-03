// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import styles from "./Sweep.module.css";

interface SweepProps {
  width?: string;
  strength?: number;
  duration?: string;
}

/**
 * The slow band of light that crosses the primary actions and the selected menu
 * entry.
 *
 * Its parent needs `position: relative` and `overflow: hidden`. Decorative, so
 * it carries no accessible role and disappears with the motion switch.
 */
export function Sweep({ width, strength, duration }: SweepProps) {
  return (
    <span
      aria-hidden
      className={styles.sweep}
      style={
        {
          "--sweep-width": width,
          "--sweep-strength": strength,
          "--sweep-duration": duration,
        } as React.CSSProperties
      }
    />
  );
}

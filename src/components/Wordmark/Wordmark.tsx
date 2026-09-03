// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import styles from "./Wordmark.module.css";

interface WordmarkProps {
  /** Large, flanked by rules, for the lock screen; small for the sidebar. */
  size?: "large" | "small";
}

/**
 * The Keyblade wordmark.
 *
 * The name is set in a gradient clipped to the text, flanked by two diamonds
 * and hairline rules. It appears at two sizes and is otherwise identical, so it
 * is one component: the wordmark is the piece most likely to be adjusted, and it
 * should only need adjusting once.
 */
export function Wordmark({ size = "large" }: WordmarkProps) {
  const small = size === "small";

  return (
    <span
      className={styles.wordmark}
      style={
        {
          "--gap": small ? "var(--space-2)" : "var(--space-4)",
          "--name-size": small ? "1rem" : "var(--text-display)",
          "--diamond": small ? "4px" : "5px",
        } as React.CSSProperties
      }
    >
      {!small && <span aria-hidden className={styles.ruleLeft} />}
      <span aria-hidden className={styles.diamond} />
      <span className={styles.name}>Keyblade</span>
      <span aria-hidden className={styles.diamond} />
      <span
        aria-hidden
        className={styles.ruleRight}
        style={small ? ({ "--rule-flex": 1, "--rule-width": "auto" } as React.CSSProperties) : undefined}
      />
    </span>
  );
}

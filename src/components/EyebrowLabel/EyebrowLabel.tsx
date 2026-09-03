// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { Icon, type IconName } from "../Icon/Icon";
import styles from "./EyebrowLabel.module.css";

type Tone = "faint" | "muted" | "gold" | "safe" | "danger";

const TONE_COLOUR: Record<Tone, string> = {
  faint: "var(--faint)",
  muted: "var(--muted)",
  gold: "var(--gold)",
  safe: "var(--safe)",
  danger: "var(--danger)",
};

interface EyebrowLabelProps {
  children: React.ReactNode;
  icon?: IconName;
  tone?: Tone;
  /** Slightly larger variant, for the HUD rows. */
  size?: "xs" | "sm";
  className?: string;
}

/**
 * The small monospaced, letterspaced, uppercase caption used to head almost
 * every group in the interface.
 *
 * It appears more than a dozen times in the design with only the colour and the
 * icon changing, which is exactly the shape of thing that should be one
 * component rather than a repeated inline style.
 */
export function EyebrowLabel({
  children,
  icon,
  tone = "faint",
  size = "xs",
  className,
}: EyebrowLabelProps) {
  return (
    <span
      className={[styles.eyebrow, className].filter(Boolean).join(" ")}
      style={
        {
          "--tone": TONE_COLOUR[tone],
          "--size": size === "sm" ? "var(--text-xs)" : "var(--text-2xs)",
        } as React.CSSProperties
      }
    >
      {icon !== undefined && <Icon name={icon} size={size === "sm" ? 15 : 13} />}
      <span className={styles.text}>{children}</span>
    </span>
  );
}

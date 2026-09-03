// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import styles from "./HatchPanel.module.css";

interface HatchPanelProps {
  children: React.ReactNode;
  /** Dashed marks a target you can act on; solid marks a placeholder you cannot. */
  border?: "dashed" | "solid";
  surface?: string;
  borderColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The diagonally hatched surface behind the file dropzone and the viewer
 * placeholder.
 *
 * The hatch is doing real work: it marks a region that holds no content *yet*,
 * which is why it appears in both places and nowhere else.
 */
export function HatchPanel({
  children,
  border = "dashed",
  surface,
  borderColor,
  className,
  style,
}: HatchPanelProps) {
  return (
    <div
      className={[styles.hatch, className].filter(Boolean).join(" ")}
      style={
        {
          "--hatch-border-style": border,
          "--hatch-surface": surface,
          "--hatch-border": borderColor,
          ...style,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { useId } from "react";

import { Icon, type IconName } from "../Icon/Icon";
import styles from "./TextField.module.css";

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Leading icon inside the field. */
  icon?: IconName;
  /** Trailing control, such as the password generator. */
  trailing?: React.ReactNode;
  /** Visually hidden when a separate label element is already present. */
  label: string;
  height?: "md" | "lg" | "xl";
  /** Search and note fields read better in the body face than in mono. */
  face?: "mono" | "body";
  surface?: string;
}

const HEIGHTS = { md: "var(--control-md)", lg: "var(--control-lg)", xl: "var(--control-xl)" };

/**
 * A single-line input with an optional leading icon and trailing control.
 *
 * Every instance takes a `label`. The design labels its fields with a separate
 * caption above the box, which is fine visually but leaves the input itself
 * unnamed for anyone not looking at the screen; `aria-label` closes that without
 * changing the picture.
 */
export function TextField({
  icon,
  trailing,
  label,
  height = "lg",
  face = "mono",
  surface,
  className,
  ...rest
}: TextFieldProps) {
  const id = useId();

  return (
    <div
      className={[styles.field, className].filter(Boolean).join(" ")}
      style={
        {
          "--height": HEIGHTS[height],
          "--surface": surface,
          "--input-font": face === "body" ? "var(--font-body)" : "var(--font-mono)",
          "--input-tracking": face === "body" ? "normal" : "0.03em",
        } as React.CSSProperties
      }
    >
      {icon !== undefined && <Icon name={icon} size={17} color="var(--faint)" />}
      <input id={id} aria-label={label} className={styles.input} {...rest} />
      {trailing}
    </div>
  );
}

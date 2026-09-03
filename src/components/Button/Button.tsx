// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { Icon, type IconName } from "../Icon/Icon";
import { Sweep } from "./Sweep";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "danger" | "quiet";
type Size = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: Variant;
  size?: Size;
  /** Leading icon. On an icon-only button this is the whole content. */
  icon?: IconName;
  /** Colour for the leading icon; defaults to the button's own ink. */
  iconColor?: string;
  /** The band of light across the primary actions. */
  sweep?: boolean;
  children?: React.ReactNode;
}

const ICON_SIZE: Record<Size, number> = { sm: 16, md: 19, lg: 18, xl: 19 };

/**
 * Every button in the application.
 *
 * The design draws six visually distinct buttons; they turn out to be four
 * variants across four sizes, which is why this is one component with custom
 * properties per variant rather than six components sharing a stylesheet.
 *
 * An icon-only button must be given a `title`, which doubles as its accessible
 * name: an unlabelled icon is unusable with a screen reader, and the design uses
 * several.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconColor,
  sweep = false,
  children,
  className,
  title,
  ...rest
}: ButtonProps) {
  const iconOnly = children === undefined;

  return (
    <button
      type="button"
      title={title}
      aria-label={iconOnly ? title : undefined}
      className={[
        styles.button,
        styles[variant],
        styles[size],
        iconOnly ? styles.iconOnly : undefined,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {sweep && <Sweep width="40%" strength={0.18} duration="5.2s" />}
      {icon !== undefined && (
        <Icon
          name={icon}
          size={ICON_SIZE[size]}
          color={iconColor ?? (variant === "primary" ? "var(--gold)" : undefined)}
        />
      )}
      {children !== undefined && <span className={styles.label}>{children}</span>}
    </button>
  );
}

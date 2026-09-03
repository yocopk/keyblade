// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { ICON_PATHS, type IconName } from "./paths";

export type { IconName };

interface IconProps {
  /** Which glyph to draw. Constrained to the generated set, so a typo fails the build. */
  name: IconName;
  /** Rendered size in pixels. Icons are square. */
  size?: number;
  /** Any CSS colour. Defaults to the surrounding text colour. */
  color?: string;
  /**
   * Accessible label. Omit it for icons that decorate text already present: an
   * icon that repeats its neighbour is noise in a screen reader, not an
   * improvement.
   */
  label?: string;
  className?: string;
}

/**
 * An inline SVG icon.
 *
 * Path data is generated into `paths.ts` from the Material Symbols sources
 * rather than loaded as an icon font. A font would be a network request in the
 * original design, an opaque binary in the repository, and impossible to
 * tree-shake. See `scripts/build-icons.mjs`.
 */
export function Icon({ name, size = 20, color, label, className }: IconProps) {
  const glyph = ICON_PATHS[name];
  const decorative = label === undefined;

  return (
    <svg
      className={className}
      viewBox={glyph.viewBox}
      width={size}
      height={size}
      fill={color ?? "currentColor"}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={label}
      focusable="false"
      style={{ display: "block", flex: "none" }}
    >
      <path d={glyph.d} />
    </svg>
  );
}

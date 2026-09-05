// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { useLayoutEffect, useRef } from "react";

import { drawStainedGlass, type GlassPalette } from "./draw";

/**
 * Colours pulled from the tokens rather than written here, so the window follows
 * the palette like everything else.
 */
const PALETTE: GlassPalette = {
  ground: "#0a1224",
  lead: "rgba(8, 11, 20, 0.92)",
  accent: "#e8c170",
  accentLight: "#f6e7be",
  accentDeep: "#b78c3f",
  light: "#f3eddf",
};

interface StainedGlassProps {
  /** The vault salt. Identical salts always produce an identical window. */
  salt: string;
  /** Rendered diameter in CSS pixels. */
  size: number;
  /** Override the ring count; otherwise it comes from the salt. */
  rings?: number;
  /** Accessible description. Omit for a purely decorative instance. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A vault's stained-glass sigil.
 *
 * Repainted only when the salt, the size or the ring count changes: the figure
 * is deterministic, so there is nothing to gain from redrawing it on every
 * render, and a 452px canvas is not free.
 */
export function StainedGlass({ salt, size, rings, label, className, style }: StainedGlassProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // useLayoutEffect, not useEffect, and the difference is visible.
  //
  // useEffect runs after the browser has painted, so the canvas was empty for
  // the first frames of the lock screen's entrance animation. What you saw was
  // an empty circle fading in, and then the window appearing all at once,
  // already at full size, part-way through — which reads as no animation at all.
  //
  // Running before paint means the glass exists on frame one and actually
  // performs the entrance it was given.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    drawStainedGlass(canvas, { salt, size, rings, palette: PALETTE });
  }, [salt, size, rings]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role={label === undefined ? undefined : "img"}
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      style={{ width: size, height: size, display: "block", borderRadius: "50%", ...style }}
    />
  );
}

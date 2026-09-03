// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { rngOf, seedOf } from "../../lib/seed";

/** Colours the rosette needs. Passed in so the drawing owns no palette of its own. */
export interface GlassPalette {
  /** The dark ground the panes sit on, and the lead between them. */
  readonly ground: string;
  readonly lead: string;
  /** The accent, used for the medallion, the key and the outer rim. */
  readonly accent: string;
  readonly accentLight: string;
  readonly accentDeep: string;
  /** The warm light washed across the whole window. */
  readonly light: string;
}

export interface GlassOptions {
  /** The vault salt. Same salt, same window, always. */
  readonly salt: string;
  /** Rendered diameter in CSS pixels. */
  readonly size: number;
  readonly palette: GlassPalette;
  /** Override the ring count. Left out, it is derived from the salt. */
  readonly rings?: number;
}

/**
 * Draws a vault's stained-glass rosette.
 *
 * The whole figure is a deterministic function of the salt: spoke count, ring
 * count, hue, rotation and every pane colour come out of one seeded generator.
 * Two vaults cannot produce the same window, and one vault cannot produce two.
 *
 * That is what makes it useful rather than decorative. It is an anti-phishing
 * cue with no text to misread: a window you do not recognise is not your vault.
 */
export function drawStainedGlass(canvas: HTMLCanvasElement, options: GlassOptions): void {
  const { salt, size, palette } = options;
  const context = canvas.getContext("2d");
  if (context === null || size <= 0) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, size, size);

  const random = rngOf(seedOf(salt));
  const centre = size / 2;
  const radius = size / 2 - 1;

  const spokes = 8 + Math.floor(random() * 5);
  const rings = options.rings ?? 3 + Math.floor(random() * 3);
  const hue = 196 + random() * 46;
  const rotation = random() * Math.PI * 2;
  const leadWidth = size > 120 ? Math.max(1.4, size * 0.005) : 0.9;
  const medallion = radius * 0.34;

  context.save();
  context.beginPath();
  context.arc(centre, centre, radius, 0, Math.PI * 2);
  context.clip();

  context.fillStyle = palette.ground;
  context.fillRect(0, 0, size, size);

  // Pane colours: mostly cool glass, with occasional clear and gold panes so the
  // window reads as leaded glass rather than a colour wheel.
  const paneColour = (ring: number): string => {
    const roll = random();
    if (roll < 0.1) return `hsla(${hue + 60}, 20%, 88%, 0.9)`;
    if (roll < 0.24) return `rgba(232, 193, 112, ${(0.32 + random() * 0.35).toFixed(2)})`;
    if (roll < 0.52) {
      return `hsl(${hue + random() * 22 - 11}, ${48 + random() * 20}%, ${18 + ring * 4 + random() * 10}%)`;
    }
    return `hsl(${hue - 12 + random() * 30}, ${38 + random() * 26}%, ${12 + ring * 3 + random() * 8}%)`;
  };

  for (let ring = 0; ring < rings; ring += 1) {
    const outer = medallion + (radius - medallion) * (1 - ring / rings);
    const inner = medallion + (radius - medallion) * (1 - (ring + 1) / rings);
    // The outermost ring gets twice the panes, which keeps the pane area roughly
    // even as the circumference grows.
    const panes = ring === 0 ? spokes * 2 : spokes;

    for (let i = 0; i < panes; i += 1) {
      const from = rotation + (i / panes) * Math.PI * 2;
      const to = rotation + ((i + 1) / panes) * Math.PI * 2;
      context.beginPath();
      context.arc(centre, centre, outer, from, to);
      context.arc(centre, centre, inner, to, from, true);
      context.closePath();
      context.fillStyle = paneColour(ring);
      context.fill();
      context.lineWidth = leadWidth;
      context.strokeStyle = palette.lead;
      context.stroke();
    }

    context.beginPath();
    context.arc(centre, centre, outer, 0, Math.PI * 2);
    context.lineWidth = leadWidth * 1.6;
    context.strokeStyle = palette.lead;
    context.stroke();
  }

  drawMedallion(context, centre, medallion, size, palette);

  // A single light source, high and to the left, washed over the whole window.
  const wash = context.createRadialGradient(
    centre - radius * 0.3,
    centre - radius * 0.34,
    radius * 0.05,
    centre,
    centre,
    radius,
  );
  wash.addColorStop(0, `${palette.light}29`);
  wash.addColorStop(0.55, `${palette.light}05`);
  wash.addColorStop(1, `${palette.ground}80`);
  context.fillStyle = wash;
  context.fillRect(0, 0, size, size);
  context.restore();

  context.beginPath();
  context.arc(centre, centre, radius - leadWidth, 0, Math.PI * 2);
  context.lineWidth = Math.max(1.2, size * 0.008);
  context.strokeStyle = `${palette.accent}b8`;
  context.stroke();
}

/** The centre: a dark disc, two rims, and a key. */
function drawMedallion(
  context: CanvasRenderingContext2D,
  centre: number,
  medallion: number,
  size: number,
  palette: GlassPalette,
): void {
  const face = context.createRadialGradient(
    centre,
    centre - medallion * 0.3,
    medallion * 0.1,
    centre,
    centre,
    medallion,
  );
  face.addColorStop(0, "rgba(20, 32, 58, 0.98)");
  face.addColorStop(1, "rgba(8, 11, 20, 0.99)");

  context.beginPath();
  context.arc(centre, centre, medallion, 0, Math.PI * 2);
  context.fillStyle = face;
  context.fill();
  context.lineWidth = Math.max(1.2, size * 0.009);
  context.strokeStyle = palette.accent;
  context.stroke();

  context.beginPath();
  context.arc(centre, centre, medallion * 0.86, 0, Math.PI * 2);
  context.lineWidth = Math.max(0.6, size * 0.0022);
  context.strokeStyle = `${palette.accent}6b`;
  context.stroke();

  // The key: a bow and a blade, in the accent gradient.
  const keyRadius = medallion * 0.34;
  const keyY = centre - keyRadius * 0.375;
  const metal = context.createLinearGradient(
    centre,
    keyY - keyRadius * 1.6,
    centre,
    keyY + keyRadius * 2.3,
  );
  metal.addColorStop(0, palette.accentLight);
  metal.addColorStop(0.5, palette.accent);
  metal.addColorStop(1, palette.accentDeep);
  context.fillStyle = metal;

  context.beginPath();
  context.arc(centre, keyY - keyRadius * 0.55, keyRadius, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.moveTo(centre - keyRadius * 0.44, keyY + keyRadius * 0.2);
  context.lineTo(centre + keyRadius * 0.44, keyY + keyRadius * 0.2);
  context.lineTo(centre + keyRadius * 0.86, keyY + keyRadius * 2.3);
  context.lineTo(centre - keyRadius * 0.86, keyY + keyRadius * 2.3);
  context.closePath();
  context.fill();
}

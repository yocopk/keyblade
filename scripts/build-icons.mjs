// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese
//
// Generates src/components/Icon/paths.ts from the Material Symbols sources.
//
// The icons are inlined as path data rather than loaded as a font, for three
// reasons: an icon font is a network request in the mock and this application
// makes none, a subset font is an opaque binary in the repository, and 46 paths
// tree-shake while a font does not.
//
// @material-symbols/svg-400 is a devDependency. It is read at build time and
// never shipped. Regenerate with `pnpm icons`.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = "node_modules/@material-symbols/svg-400/rounded";

/** Every icon the interface uses. Keep sorted; the union type is derived from it. */
const ICONS = [
  "account_balance", "add", "alternate_email", "animation", "arrow_drop_down",
  "autorenew", "badge", "block", "blur_on", "check", "close",
  "cloud_off", "content_copy", "cottage", "database", "deployed_code",
  "description", "directions_car", "dns", "enhanced_encryption", "face",
  "fingerprint", "gavel", "grain", "image", "info", "key_vertical", "label", "list_alt",
  "lock", "lock_open", "medical_services", "memory", "movie", "notes",
  "password", "payments", "person", "photo_library", "picture_as_pdf",
  "play_arrow", "play_circle", "priority_high", "router", "screenshot_monitor",
  "search", "search_off", "shield_lock", "sticky_note_2", "terminal", "timer",
  "tune", "upload_file", "visibility", "visibility_off", "vpn_key", "wifi",
];

/** Pulls the `d` attributes out of an SVG, in document order. */
function extractPaths(svg) {
  const out = [];
  const re = /<path[^>]*\sd="([^"]+)"/g;
  let m;
  while ((m = re.exec(svg)) !== null) out.push(m[1]);
  return out;
}

const entries = [];
const missing = [];

for (const name of ICONS) {
  let svg;
  try {
    svg = readFileSync(resolve(SOURCE, `${name}.svg`), "utf8");
  } catch {
    missing.push(name);
    continue;
  }
  const paths = extractPaths(svg);
  if (paths.length === 0) {
    missing.push(name);
    continue;
  }
  // Material Symbols ship on a 0 0 960 960 grid with a flipped baseline.
  const viewBox = (svg.match(/viewBox="([^"]+)"/) ?? [, "0 -960 960 960"])[1];
  entries.push({ name, viewBox, d: paths.join(" ") });
}

if (missing.length > 0) {
  console.error(`Missing icons: ${missing.join(", ")}`);
  process.exit(1);
}

const body = entries
  .map((e) => `  ${JSON.stringify(e.name)}: { viewBox: ${JSON.stringify(e.viewBox)}, d: ${JSON.stringify(e.d)} },`)
  .join("\n");

const file = `// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese
//
// GENERATED FILE — do not edit by hand. Run \`pnpm icons\` to regenerate.
//
// Path data from Material Symbols (Google), licensed under Apache-2.0.
// See NOTICE for the third-party attribution.

export interface IconGlyph {
  readonly viewBox: string;
  readonly d: string;
}

export const ICON_PATHS = {
${body}
} as const satisfies Record<string, IconGlyph>;

/** Every icon name the interface may reference. */
export type IconName = keyof typeof ICON_PATHS;
`;

writeFileSync("src/components/Icon/paths.ts", file, "utf8");
const bytes = Buffer.byteLength(file, "utf8");
console.log(`Wrote ${entries.length} icons to src/components/Icon/paths.ts (${(bytes / 1024).toFixed(1)} kB)`);

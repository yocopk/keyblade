// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese
//
// Copies the font files the interface uses into src/assets/fonts, and writes
// the @font-face declarations for them.
//
// The fonts are self-hosted rather than loaded from Google Fonts, for the same
// reason as the icons: a font request is a network request, and this application
// makes none. The CSP would block it anyway (`font-src 'self'`), which would
// leave the interface silently rendering in fallback faces.
//
// The @fontsource packages are devDependencies. They are read here and never
// shipped; the extracted .woff2 files are committed so a clone builds without
// them. Regenerate with `pnpm fonts`.

import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = "src/assets/fonts";

/**
 * Only the weights the interface actually sets. Shipping the rest would be
 * ~30 kB each of font nobody renders.
 *
 * The `latin` subset covers Italian and English, including the middle dot and
 * en dash the copy uses. Arrows (↑↓) fall outside it and render from the system
 * fallback, which is correct: they are symbols, not text in these faces.
 */
const FONTS = [
  { package: "marcellus", family: "Marcellus", weights: [400] },
  { package: "cinzel-decorative", family: "Cinzel Decorative", weights: [700] },
  { package: "ibm-plex-sans", family: "IBM Plex Sans", weights: [400, 500, 600] },
  { package: "ibm-plex-mono", family: "IBM Plex Mono", weights: [400, 500] },
];

mkdirSync(OUT_DIR, { recursive: true });

const faces = [];
let total = 0;

for (const font of FONTS) {
  const base = `node_modules/@fontsource/${font.package}`;

  // The OFL requires the licence to travel with the files.
  const licence = `${font.package}-OFL.txt`;
  copyFileSync(resolve(base, "LICENSE"), resolve(OUT_DIR, licence));

  for (const weight of font.weights) {
    const file = `${font.package}-latin-${weight}-normal.woff2`;
    const from = resolve(base, "files", file);
    const to = resolve(OUT_DIR, file);
    copyFileSync(from, to);
    total += statSync(to).size;

    faces.push(
      [
        "@font-face {",
        `  font-family: "${font.family}";`,
        "  font-style: normal;",
        `  font-weight: ${weight};`,
        // Swap, not block: the interface must be readable while the face loads,
        // and from a local file that window is a frame or two anyway.
        "  font-display: swap;",
        `  src: url("../assets/fonts/${file}") format("woff2");`,
        "  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,",
        "    U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122,",
        "    U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;",
        "}",
      ].join("\n"),
    );
  }
}

const header = `/* SPDX-License-Identifier: AGPL-3.0-only
 * SPDX-FileCopyrightText: 2026 Andrea Marchese
 *
 * GENERATED FILE — do not edit by hand. Run \`pnpm fonts\` to regenerate.
 *
 * Self-hosted faces. Nothing here reaches the network: the files sit in
 * src/assets/fonts and the CSP allows font-src 'self' only.
 *
 * Fonts are licensed under the SIL Open Font License 1.1; the licence text for
 * each ships alongside the files. See NOTICE.
 */
`;

writeFileSync("src/styles/fonts.css", `${header}\n${faces.join("\n\n")}\n`, "utf8");

const kb = (total / 1024).toFixed(1);
console.log(`Wrote ${faces.length} faces to src/styles/fonts.css (${kb} kB of woff2)`);

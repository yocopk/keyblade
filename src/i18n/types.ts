// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import type { it } from "./it";

/**
 * The shape every locale must satisfy, derived from Italian.
 *
 * A locale missing a key, or carrying one Italian does not have, fails
 * typecheck. That is the whole reason the dictionaries are typed rather than
 * loaded as JSON at runtime: a missing translation is a build error, not a
 * blank label somebody notices in production.
 */
export type Dictionary = {
  readonly [S in keyof typeof it]: { readonly [K in keyof (typeof it)[S]]: string };
};

/** Locales the application ships. */
export const LOCALES = ["it", "en"] as const;
export type Locale = (typeof LOCALES)[number];

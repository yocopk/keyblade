// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

/**
 * A very small translation layer.
 *
 * No i18n library. The application has one dictionary shape, two locales and no
 * pluralisation rules beyond token substitution. A library would add a
 * dependency, a bundle and a runtime loader to a program whose whole argument is
 * that it loads nothing. The dictionaries are typed against each other, so a
 * missing key is a build error rather than a blank label somebody notices later.
 */

import { createContext, useContext } from "react";

import { en } from "./en";
import { it } from "./it";
import { LOCALES, type Dictionary, type Locale } from "./types";

export { LOCALES };
export type { Locale, Dictionary };

const DICTIONARIES: Record<Locale, Dictionary> = { it, en };

/** Italian is the default: it is the language the interface was designed in. */
export const DEFAULT_LOCALE: Locale = "it";

export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Substitutes {token} placeholders. */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (values === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

/** The active dictionary, plus a formatter for strings carrying placeholders. */
export function useTranslation(): {
  t: Dictionary;
  locale: Locale;
  format: (template: string, values?: Record<string, string | number>) => string;
} {
  const locale = useContext(LocaleContext);
  return { t: DICTIONARIES[locale], locale, format: interpolate };
}

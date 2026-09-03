// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import type { IconName } from "../components/Icon/Icon";

/** The five content categories, plus settings, that the command menu lists. */
export const CATEGORY_IDS = ["passwords", "documents", "images", "videos", "notes"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Categories whose items are blobs on disk rather than rows in the index. */
export const FILE_CATEGORIES: ReadonlySet<CategoryId> = new Set<CategoryId>([
  "documents",
  "images",
  "videos",
]);

export interface VaultField {
  /** Shown as the uppercase caption above the value. */
  readonly label: string;
  readonly value: string;
  /** Masked until revealed, and never left on screen by default. */
  readonly secret: boolean;
}

export interface VaultItem {
  readonly id: string;
  readonly name: string;
  /** One line of context under the name. */
  readonly subtitle: string;
  readonly tag: string;
  /** The right-hand column: a size, a scheme, a badge. */
  readonly badge: string;
  readonly icon: IconName;
  /** True when the content lives in an encrypted blob rather than the index. */
  readonly isFile: boolean;
  /** Which viewer would open it. */
  readonly viewerIcon?: IconName;
  readonly fields: readonly VaultField[];
}

export interface VaultSummary {
  /** The salt, which is also what the stained-glass sigil is drawn from. */
  readonly salt: string;
  readonly fileName: string;
}

export type ItemsByCategory = Readonly<Record<CategoryId, readonly VaultItem[]>>;

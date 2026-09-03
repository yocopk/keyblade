// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

/**
 * Deterministic seeding for the stained-glass sigil.
 *
 * The rosette drawn for a vault is derived from that vault's salt, so the same
 * vault always shows the same window and two vaults never show the same one.
 * That makes it an anti-phishing cue: a glass you do not recognise is not your
 * vault.
 *
 * These are hashes for *drawing*, not for security. They must never be used
 * where a cryptographic hash is required — that lives in Rust.
 */

/** FNV-1a over a string, for turning a salt into a 32-bit seed. */
export function seedOf(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast, and identical across runs for a given seed. */
export function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

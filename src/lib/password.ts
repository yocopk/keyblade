// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

/**
 * Alphabet without the characters people misread: no l, I, 1, O, 0.
 *
 * 64 characters exactly, which matters for the rejection sampling below.
 */
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!#%&*-_?";

/** Largest multiple of the alphabet size that fits in a byte. */
const LIMIT = Math.floor(256 / ALPHABET.length) * ALPHABET.length;

/**
 * Generates a password from the platform CSPRNG.
 *
 * Two details that are easy to get wrong and expensive to get wrong:
 *
 * `crypto.getRandomValues` only — never `Math.random`, which is seeded, and
 * predictable from a handful of outputs.
 *
 * Bytes at or above `LIMIT` are discarded rather than reduced with `%`. Taking
 * the modulus of a uniform byte over an alphabet that does not divide 256
 * evenly makes the first characters of the alphabet more likely. With 64
 * characters it happens to divide exactly, but the rejection stays: the
 * alphabet is the sort of thing that gets edited later, and a bias introduced
 * that way would be silent.
 *
 * This will move to Rust when the vault exists, so that generated passwords are
 * zeroised like everything else. For now it is honest about being a browser
 * CSPRNG.
 */
export function generatePassword(length = 20): string {
  const out: string[] = [];
  const buffer = new Uint8Array(length * 2);

  while (out.length < length) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (out.length === length) break;
      if (byte >= LIMIT) continue;
      out.push(ALPHABET[byte % ALPHABET.length]);
    }
  }

  return out.join("");
}

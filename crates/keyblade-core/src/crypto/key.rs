// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

//! A 32-byte key that zeroises itself and refuses to be printed.

use subtle::ConstantTimeEq;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Length of every symmetric key in Keyblade.
pub const KEY_LEN: usize = 32;

/// A 32-byte symmetric key.
///
/// Wiped from memory when dropped. It has no `Debug` output, no `Display`, and
/// no `PartialEq` that could be used as a timing oracle. Reading the bytes is
/// deliberately verbose: call [`Key32::expose`] and keep the borrow short.
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct Key32([u8; KEY_LEN]);

impl Key32 {
    /// Wraps raw bytes that are already key material.
    pub fn from_bytes(bytes: [u8; KEY_LEN]) -> Self {
        Self(bytes)
    }

    /// Generates a fresh key from the operating system CSPRNG.
    pub fn generate() -> Self {
        use rand_core::{OsRng, RngCore};
        let mut bytes = [0u8; KEY_LEN];
        OsRng.fill_bytes(&mut bytes);
        Self(bytes)
    }

    /// Borrows the raw key bytes.
    ///
    /// Every call site is a place where key material is visible, so keep the
    /// borrow as short as possible and never copy the result into a type that
    /// does not zeroise.
    pub fn expose(&self) -> &[u8; KEY_LEN] {
        &self.0
    }

    /// Constant-time equality.
    ///
    /// Not `PartialEq`, so that `==` cannot be used by accident on a secret.
    pub fn ct_eq(&self, other: &Self) -> bool {
        self.0.ct_eq(&other.0).into()
    }
}

impl core::fmt::Debug for Key32 {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("Key32(<redacted>)")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn debug_output_never_contains_key_material() {
        let key = Key32::from_bytes([0xAB; KEY_LEN]);
        let rendered = format!("{key:?}");
        assert_eq!(rendered, "Key32(<redacted>)");
        assert!(
            !rendered.contains("ab"),
            "key bytes leaked into Debug output"
        );
    }

    #[test]
    fn generate_does_not_return_a_constant() {
        let a = Key32::generate();
        let b = Key32::generate();
        assert!(!a.ct_eq(&b), "CSPRNG returned the same key twice");
        assert_ne!(a.expose(), &[0u8; KEY_LEN], "key is all zeroes");
    }

    #[test]
    fn ct_eq_matches_ordinary_equality() {
        let a = Key32::from_bytes([7u8; KEY_LEN]);
        let b = Key32::from_bytes([7u8; KEY_LEN]);
        let mut different = [7u8; KEY_LEN];
        different[31] = 8;
        let c = Key32::from_bytes(different);

        assert!(a.ct_eq(&b));
        assert!(!a.ct_eq(&c));
    }
}

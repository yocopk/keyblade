// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

//! Authenticated encryption, and the key wrapping built on top of it.
//!
//! XChaCha20-Poly1305 throughout. Its 192-bit nonce can be generated randomly
//! for every message with no practical collision risk, which AES-GCM's 96-bit
//! nonce cannot offer at the number of messages a file vault produces. It is
//! also constant-time in pure software, with no dependency on AES-NI being
//! present and enabled.

use chacha20poly1305::aead::{Aead, Payload};
use chacha20poly1305::{KeyInit, XChaCha20Poly1305, XNonce};
use rand_core::{OsRng, RngCore};

use super::error::{CryptoError, Result};
use super::key::{Key32, KEY_LEN};

/// Nonce length for XChaCha20-Poly1305.
pub const NONCE_LEN: usize = 24;

/// Poly1305 authentication tag length.
pub const TAG_LEN: usize = 16;

/// Size of a wrapped 32-byte key: nonce, then ciphertext, then tag.
pub const WRAPPED_KEY_LEN: usize = NONCE_LEN + KEY_LEN + TAG_LEN;

/// A key encrypted under another key.
///
/// Carries its own nonce, so a wrapped key is self-contained and can be moved
/// between a vault header and a file header without extra bookkeeping.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct WrappedKey([u8; WRAPPED_KEY_LEN]);

impl WrappedKey {
    /// Borrows the wrapped bytes. These are ciphertext and safe to store.
    pub fn as_bytes(&self) -> &[u8; WRAPPED_KEY_LEN] {
        &self.0
    }

    /// Reconstructs from stored bytes.
    pub fn from_bytes(bytes: [u8; WRAPPED_KEY_LEN]) -> Self {
        Self(bytes)
    }
}

impl core::fmt::Debug for WrappedKey {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "WrappedKey({} bytes)", WRAPPED_KEY_LEN)
    }
}

/// Encrypts `dek` under `kek`, binding the result to `aad`.
///
/// `aad` is what stops a wrapped key from being lifted out of one context and
/// pasted into another: a content key cannot be presented where a database key
/// is expected, because the associated data will not match.
pub fn wrap_key(kek: &Key32, dek: &Key32, aad: &[u8]) -> Result<WrappedKey> {
    let mut nonce = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce);
    wrap_key_with_nonce(kek, dek, aad, &nonce)
}

/// Key wrapping with a caller-supplied nonce.
///
/// Only for test vectors, which have to be reproducible. Never expose this: a
/// repeated nonce under the same key is catastrophic for any AEAD.
pub(crate) fn wrap_key_with_nonce(
    kek: &Key32,
    dek: &Key32,
    aad: &[u8],
    nonce: &[u8; NONCE_LEN],
) -> Result<WrappedKey> {
    let cipher = XChaCha20Poly1305::new(kek.expose().into());
    let sealed = cipher
        .encrypt(
            XNonce::from_slice(nonce),
            Payload {
                msg: dek.expose(),
                aad,
            },
        )
        .map_err(|_| CryptoError::Decrypt)?;

    debug_assert_eq!(sealed.len(), KEY_LEN + TAG_LEN);

    let mut out = [0u8; WRAPPED_KEY_LEN];
    out[..NONCE_LEN].copy_from_slice(nonce);
    out[NONCE_LEN..].copy_from_slice(&sealed);
    Ok(WrappedKey(out))
}

/// Recovers a key wrapped by [`wrap_key`].
///
/// Fails if the wrapping key is wrong, the bytes were altered, or `aad` differs
/// from the value used when wrapping. Which of those it was is not reported.
pub fn unwrap_key(kek: &Key32, wrapped: &WrappedKey, aad: &[u8]) -> Result<Key32> {
    let cipher = XChaCha20Poly1305::new(kek.expose().into());
    let nonce = XNonce::from_slice(&wrapped.0[..NONCE_LEN]);

    let mut plain = cipher
        .decrypt(
            nonce,
            Payload {
                msg: &wrapped.0[NONCE_LEN..],
                aad,
            },
        )
        .map_err(|_| CryptoError::Decrypt)?;

    if plain.len() != KEY_LEN {
        zeroize::Zeroize::zeroize(&mut plain);
        return Err(CryptoError::Decrypt);
    }

    let mut bytes = [0u8; KEY_LEN];
    bytes.copy_from_slice(&plain);
    zeroize::Zeroize::zeroize(&mut plain);

    let key = Key32::from_bytes(bytes);
    zeroize::Zeroize::zeroize(&mut bytes);
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    const AAD: &[u8] = b"keyblade:test:v1";

    #[test]
    fn wrapped_key_round_trips() {
        let kek = Key32::from_bytes([1u8; KEY_LEN]);
        let dek = Key32::from_bytes([2u8; KEY_LEN]);

        let wrapped = wrap_key(&kek, &dek, AAD).unwrap();
        let recovered = unwrap_key(&kek, &wrapped, AAD).unwrap();

        assert!(dek.ct_eq(&recovered));
    }

    #[test]
    fn the_wrong_wrapping_key_fails() {
        let kek = Key32::from_bytes([1u8; KEY_LEN]);
        let wrong = Key32::from_bytes([9u8; KEY_LEN]);
        let dek = Key32::generate();

        let wrapped = wrap_key(&kek, &dek, AAD).unwrap();
        assert!(unwrap_key(&wrong, &wrapped, AAD).is_err());
    }

    #[test]
    fn different_associated_data_fails() {
        let kek = Key32::from_bytes([1u8; KEY_LEN]);
        let dek = Key32::generate();

        let wrapped = wrap_key(&kek, &dek, b"context A").unwrap();
        assert!(
            unwrap_key(&kek, &wrapped, b"context B").is_err(),
            "a wrapped key was accepted in the wrong context"
        );
    }

    /// Every single bit of a wrapped key is authenticated, including the nonce.
    #[test]
    fn flipping_any_bit_is_detected() {
        let kek = Key32::from_bytes([1u8; KEY_LEN]);
        let dek = Key32::generate();
        let wrapped = wrap_key(&kek, &dek, AAD).unwrap();

        for byte_index in 0..WRAPPED_KEY_LEN {
            for bit in 0..8u32 {
                let mut tampered = *wrapped.as_bytes();
                tampered[byte_index] ^= 1 << bit;
                let tampered = WrappedKey::from_bytes(tampered);
                assert!(
                    unwrap_key(&kek, &tampered, AAD).is_err(),
                    "tampering at byte {byte_index} bit {bit} went undetected"
                );
            }
        }
    }

    #[test]
    fn wrapping_twice_gives_different_ciphertext() {
        let kek = Key32::from_bytes([1u8; KEY_LEN]);
        let dek = Key32::from_bytes([2u8; KEY_LEN]);

        let a = wrap_key(&kek, &dek, AAD).unwrap();
        let b = wrap_key(&kek, &dek, AAD).unwrap();

        assert_ne!(
            a.as_bytes(),
            b.as_bytes(),
            "nonce is not random: the same key wrapped twice produced identical bytes"
        );
    }

    #[test]
    fn debug_output_never_contains_ciphertext() {
        let kek = Key32::from_bytes([1u8; KEY_LEN]);
        let dek = Key32::generate();
        let wrapped = wrap_key(&kek, &dek, AAD).unwrap();
        assert_eq!(format!("{wrapped:?}"), "WrappedKey(72 bytes)");
    }
}

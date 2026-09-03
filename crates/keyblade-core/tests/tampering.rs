// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

//! Negative tests: every one of these asserts that something is *rejected*.
//!
//! A round-trip test only shows that the happy path works, and a broken
//! construction passes it happily. What distinguishes an encrypted format that
//! is safe from one that merely looks encrypted is what it refuses, so these
//! tests are the ones that matter most in this crate.
//!
//! In particular, [`removing_the_final_chunk_is_detected`] is the test that a
//! naive chunked format fails. Without the STREAM final-block flag, cutting a
//! file short yields a shorter but perfectly valid-looking plaintext.

use keyblade_core::crypto::aead::TAG_LEN;
use keyblade_core::{decrypt_stream, encrypt_stream, Key32, VaultKey, CHUNK_SIZE, HEADER_LEN};

const CHUNK: usize = CHUNK_SIZE as usize;

fn vault() -> VaultKey {
    VaultKey::from_key(Key32::from_bytes([0x5A; 32]))
}

/// Two and a half chunks, so the file has a first chunk, a middle chunk and a
/// short final chunk. Single-chunk files hide entire classes of bug.
fn sample_plaintext() -> Vec<u8> {
    (0..CHUNK * 2 + CHUNK / 2)
        .map(|i| (i % 251) as u8)
        .collect()
}

fn seal(plaintext: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    encrypt_stream(plaintext, &mut out, &vault()).unwrap();
    out
}

fn open(sealed: &[u8]) -> keyblade_core::Result<Vec<u8>> {
    let mut out = Vec::new();
    decrypt_stream(sealed, &mut out, &vault())?;
    Ok(out)
}

/// Baseline. If this ever fails, every rejection below proves nothing.
#[test]
fn a_multi_chunk_file_round_trips() {
    let plaintext = sample_plaintext();
    let sealed = seal(&plaintext);
    assert_eq!(sealed.len(), HEADER_LEN + plaintext.len() + 3 * TAG_LEN);
    assert_eq!(open(&sealed).unwrap(), plaintext);
}

// ── Truncation ──────────────────────────────────────────────────────────────

/// The test a chunked format without a final-block marker silently fails.
///
/// An attacker who cuts the tail off a file must not be able to hand back a
/// shorter document that still decrypts. Here the chunk that becomes last was
/// sealed as "not last", so opening it as the last chunk fails to authenticate.
#[test]
fn removing_the_final_chunk_is_detected() {
    let sealed = seal(&sample_plaintext());
    let final_chunk_len = CHUNK / 2 + TAG_LEN;
    let truncated = &sealed[..sealed.len() - final_chunk_len];

    assert!(
        open(truncated).is_err(),
        "TRUNCATION ATTACK: a file with its last chunk removed decrypted successfully"
    );
}

#[test]
fn removing_several_chunks_is_detected() {
    let sealed = seal(&sample_plaintext());
    let keep = HEADER_LEN + (CHUNK + TAG_LEN);
    assert!(open(&sealed[..keep]).is_err());
}

#[test]
fn shaving_bytes_off_the_last_chunk_is_detected() {
    let sealed = seal(&sample_plaintext());
    for cut in [1usize, 2, TAG_LEN, TAG_LEN + 1, 1000] {
        assert!(
            open(&sealed[..sealed.len() - cut]).is_err(),
            "removing the last {cut} bytes went undetected"
        );
    }
}

#[test]
fn a_file_containing_only_a_header_is_rejected() {
    let sealed = seal(&sample_plaintext());
    assert!(open(&sealed[..HEADER_LEN]).is_err());
}

// ── Extension and reordering ────────────────────────────────────────────────

#[test]
fn appending_bytes_is_detected() {
    let mut sealed = seal(&sample_plaintext());
    sealed.extend_from_slice(&[0u8; 64]);
    assert!(
        open(&sealed).is_err(),
        "appended data after the final chunk was accepted"
    );
}

/// Chunk order is bound by the counter in the nonce, so chunks cannot be moved.
#[test]
fn swapping_two_chunks_is_detected() {
    let sealed = seal(&sample_plaintext());
    let sealed_chunk = CHUNK + TAG_LEN;

    let mut tampered = sealed.clone();
    let (first, second) = (HEADER_LEN, HEADER_LEN + sealed_chunk);
    let chunk_a = sealed[first..first + sealed_chunk].to_vec();
    let chunk_b = sealed[second..second + sealed_chunk].to_vec();
    tampered[first..first + sealed_chunk].copy_from_slice(&chunk_b);
    tampered[second..second + sealed_chunk].copy_from_slice(&chunk_a);

    assert!(open(&tampered).is_err(), "reordered chunks were accepted");
}

#[test]
fn replaying_a_chunk_in_place_of_another_is_detected() {
    let sealed = seal(&sample_plaintext());
    let sealed_chunk = CHUNK + TAG_LEN;

    let mut tampered = sealed.clone();
    let first = sealed[HEADER_LEN..HEADER_LEN + sealed_chunk].to_vec();
    let second_at = HEADER_LEN + sealed_chunk;
    tampered[second_at..second_at + sealed_chunk].copy_from_slice(&first);

    assert!(open(&tampered).is_err(), "a duplicated chunk was accepted");
}

/// A chunk lifted from one file must not be usable in another, even though both
/// were encrypted under the same vault key: the content key and nonce prefix
/// differ per file.
#[test]
fn splicing_a_chunk_from_another_file_is_detected() {
    let a = seal(&sample_plaintext());
    let b = seal(&sample_plaintext());
    let sealed_chunk = CHUNK + TAG_LEN;

    let mut tampered = a.clone();
    tampered[HEADER_LEN..HEADER_LEN + sealed_chunk]
        .copy_from_slice(&b[HEADER_LEN..HEADER_LEN + sealed_chunk]);

    assert!(
        open(&tampered).is_err(),
        "a chunk from a different file was accepted"
    );
}

// ── Bit flips ───────────────────────────────────────────────────────────────

/// Sampled rather than exhaustive: a full sweep of a 2.5 MiB file is millions of
/// decryptions. The positions cover every structurally distinct region.
#[test]
fn flipping_a_bit_anywhere_meaningful_is_detected() {
    let sealed = seal(&sample_plaintext());
    let sealed_chunk = CHUNK + TAG_LEN;

    let positions: Vec<(usize, &str)> = vec![
        (0, "magic"),
        (4, "version"),
        (6, "chunk size"),
        (12, "nonce prefix"),
        (28, "nonce prefix, last byte"),
        (35, "wrapped key nonce"),
        (60, "wrapped key ciphertext"),
        (HEADER_LEN - 1, "wrapped key tag, last byte"),
        (HEADER_LEN, "chunk 0, first byte"),
        (HEADER_LEN + CHUNK / 2, "chunk 0, middle"),
        (HEADER_LEN + CHUNK - 1, "chunk 0, last plaintext byte"),
        (HEADER_LEN + CHUNK, "chunk 0, tag"),
        (HEADER_LEN + sealed_chunk, "chunk 1, first byte"),
        (HEADER_LEN + 2 * sealed_chunk, "final chunk, first byte"),
        (sealed.len() - 1, "final chunk, last tag byte"),
    ];

    for (offset, label) in positions {
        let mut tampered = sealed.clone();
        tampered[offset] ^= 0b0000_0001;
        assert!(
            open(&tampered).is_err(),
            "a flipped bit in the {label} (offset {offset}) went undetected"
        );
    }
}

// ── Header validation ───────────────────────────────────────────────────────

#[test]
fn an_empty_file_is_rejected() {
    assert!(open(&[]).is_err());
}

#[test]
fn a_file_shorter_than_a_header_is_rejected() {
    let sealed = seal(b"short");
    for len in [1usize, 4, 50, HEADER_LEN - 1] {
        assert!(
            open(&sealed[..len]).is_err(),
            "a {len}-byte file was not rejected"
        );
    }
}

#[test]
fn a_file_that_is_not_a_keyblade_blob_is_rejected() {
    let mut sealed = seal(b"payload");
    sealed[0..4].copy_from_slice(b"RIFF");
    assert!(open(&sealed).is_err());
}

#[test]
fn an_unsupported_version_is_rejected() {
    let mut sealed = seal(b"payload");
    sealed[4..6].copy_from_slice(&999u16.to_le_bytes());
    assert!(open(&sealed).is_err());
}

/// `chunk_size` is read from the file before anything is authenticated and it
/// drives a buffer allocation. Without a ceiling this is a memory-exhaustion
/// vector, so the header parser must reject it rather than the AEAD.
#[test]
fn an_absurd_chunk_size_is_rejected_before_any_allocation() {
    let mut sealed = seal(b"payload");
    sealed[6..10].copy_from_slice(&u32::MAX.to_le_bytes());

    let err = open(&sealed).unwrap_err();
    assert!(
        matches!(err, keyblade_core::CryptoError::Header(_)),
        "expected the header parser to reject this, got {err:?}"
    );
}

#[test]
fn a_zero_chunk_size_is_rejected() {
    let mut sealed = seal(b"payload");
    sealed[6..10].copy_from_slice(&0u32.to_le_bytes());
    assert!(open(&sealed).is_err());
}

/// The header is authenticated as associated data on every chunk, so editing a
/// field that survives range validation still breaks decryption.
#[test]
fn editing_an_in_range_header_field_is_detected_by_the_chunks() {
    let mut sealed = seal(b"payload");
    // A legal chunk size, but not the one the file was sealed with.
    sealed[6..10].copy_from_slice(&(64u32 * 1024).to_le_bytes());
    assert!(
        open(&sealed).is_err(),
        "the header is not bound to the chunks as associated data"
    );
}

#[test]
fn editing_the_nonce_prefix_is_detected() {
    let mut sealed = seal(b"payload");
    sealed[10] ^= 0xFF;
    assert!(open(&sealed).is_err());
}

// ── Wrong key ───────────────────────────────────────────────────────────────

#[test]
fn every_wrong_vault_key_fails() {
    let sealed = seal(b"payload");
    for byte in [0x00u8, 0x01, 0x59, 0x5B, 0xFF] {
        let wrong = VaultKey::from_key(Key32::from_bytes([byte; 32]));
        let mut out = Vec::new();
        assert!(
            decrypt_stream(sealed.as_slice(), &mut out, &wrong).is_err(),
            "vault key of all 0x{byte:02x} opened a file it should not have"
        );
    }
}

/// The error must not say *why* it failed. A caller that can tell a wrong key
/// from a corrupt tag has an oracle for probing a stolen vault.
#[test]
fn failure_does_not_reveal_the_reason() {
    let sealed = seal(b"payload");

    let wrong_key = {
        let wrong = VaultKey::from_key(Key32::from_bytes([0xFF; 32]));
        let mut out = Vec::new();
        decrypt_stream(sealed.as_slice(), &mut out, &wrong)
            .unwrap_err()
            .to_string()
    };

    let corrupted = {
        let mut tampered = sealed.clone();
        let last = tampered.len() - 1;
        tampered[last] ^= 1;
        open(&tampered).unwrap_err().to_string()
    };

    assert_eq!(
        wrong_key, corrupted,
        "the error distinguishes a wrong key from corrupt data"
    );
    assert_eq!(wrong_key, "decryption failed");
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

//! Chunked authenticated encryption for files of any size.
//!
//! An 8 GiB video cannot be authenticated as a single message: it would have to
//! be held in memory, and the player could not seek without decrypting
//! everything before the target. So the plaintext is split into fixed-size
//! chunks, each encrypted under its own nonce.
//!
//! The chunking construction is STREAM, taken from `aead::stream` rather than
//! written here. Its nonce is `prefix ‖ counter ‖ last-block flag`, and the flag
//! is what makes truncation detectable: cutting the tail off a file leaves a
//! chunk that was sealed as "not last" being opened as "last", so the tag does
//! not verify. A chunked format without that flag looks correct and silently
//! accepts truncated files.
//!
//! # Layout
//!
//! ```text
//! ┌─ header, 101 bytes, plaintext but authenticated as AAD on every chunk ─┐
//! │ magic "KBLD" 4 │ version u16 2 │ chunk_size u32 4 │ prefix 19 │ ck 72  │
//! └────────────────────────────────────────────────────────────────────────┘
//! ┌ chunk 0 ────────┐┌ chunk 1 ────────┐     ┌ chunk N ──────────────┐
//! │ 1 MiB + tag 16  ││ 1 MiB + tag 16  │ ... │ ≤ 1 MiB + tag 16, last│
//! └─────────────────┘└─────────────────┘     └───────────────────────┘
//! ```
//!
//! Every chunk is at a computable offset, so seeking costs one decryption.

use std::io::{Read, Write};

use chacha20poly1305::aead::generic_array::GenericArray;
use chacha20poly1305::aead::stream::{DecryptorBE32, EncryptorBE32};
use chacha20poly1305::aead::Payload;
use chacha20poly1305::{KeyInit, XChaCha20Poly1305};
use rand_core::{OsRng, RngCore};

use super::aead::{WrappedKey, TAG_LEN, WRAPPED_KEY_LEN};
use super::error::{CryptoError, Result};
use super::key::Key32;
use super::keyring::VaultKey;

/// File magic.
pub const MAGIC: &[u8; 4] = b"KBLD";

/// Format version.
pub const VERSION: u16 = 1;

/// STREAM uses five nonce bytes for the counter and the final-block flag, so the
/// random prefix is what remains of the 24-byte XChaCha nonce.
pub const NONCE_PREFIX_LEN: usize = 19;

/// Default plaintext bytes per chunk.
///
/// One MiB trades 16 bytes of tag per MiB, about 0.0015% overhead, for seeks
/// that cost a single chunk decryption.
pub const CHUNK_SIZE: u32 = 1024 * 1024;

/// Smallest chunk size accepted when reading a header.
pub const MIN_CHUNK_SIZE: u32 = 4 * 1024;

/// Largest chunk size accepted when reading a header.
///
/// A denial-of-service guard. `chunk_size` is read from a file before anything
/// is authenticated, and it determines a buffer allocation.
pub const MAX_CHUNK_SIZE: u32 = 8 * 1024 * 1024;

/// Serialised header length.
pub const HEADER_LEN: usize = 4 + 2 + 4 + NONCE_PREFIX_LEN + WRAPPED_KEY_LEN;

/// Header of an encrypted blob.
///
/// Stored in plaintext, because the reader needs it before it holds any key, but
/// authenticated as associated data on every chunk. Altering any field, the
/// version or the chunk size included, makes every chunk fail to open.
#[derive(Debug, Clone, Copy)]
pub struct Header {
    /// Format version.
    pub version: u16,
    /// Plaintext bytes per chunk.
    pub chunk_size: u32,
    /// Random per-file nonce prefix.
    pub nonce_prefix: [u8; NONCE_PREFIX_LEN],
    /// The file's content key, wrapped under the vault key.
    pub wrapped_content_key: WrappedKey,
}

impl Header {
    /// Serialises the header. Integers are little-endian.
    pub fn to_bytes(&self) -> [u8; HEADER_LEN] {
        let mut out = [0u8; HEADER_LEN];
        out[0..4].copy_from_slice(MAGIC);
        out[4..6].copy_from_slice(&self.version.to_le_bytes());
        out[6..10].copy_from_slice(&self.chunk_size.to_le_bytes());
        out[10..10 + NONCE_PREFIX_LEN].copy_from_slice(&self.nonce_prefix);
        out[10 + NONCE_PREFIX_LEN..].copy_from_slice(self.wrapped_content_key.as_bytes());
        out
    }

    /// Parses and validates a header.
    ///
    /// This is the only place in the crate that interprets untrusted bytes
    /// before a key is involved, which makes it the fuzzing target. Every field
    /// is range-checked; nothing is trusted because it "came from our own
    /// writer".
    pub fn from_bytes(bytes: &[u8; HEADER_LEN]) -> Result<Self> {
        if &bytes[0..4] != MAGIC {
            return Err(CryptoError::Header("not a Keyblade blob"));
        }

        let version = u16::from_le_bytes(bytes[4..6].try_into().expect("2 bytes"));
        if version != VERSION {
            return Err(CryptoError::Header("unsupported format version"));
        }

        let chunk_size = u32::from_le_bytes(bytes[6..10].try_into().expect("4 bytes"));
        if !(MIN_CHUNK_SIZE..=MAX_CHUNK_SIZE).contains(&chunk_size) {
            return Err(CryptoError::Header("chunk size out of range"));
        }

        let mut nonce_prefix = [0u8; NONCE_PREFIX_LEN];
        nonce_prefix.copy_from_slice(&bytes[10..10 + NONCE_PREFIX_LEN]);

        let mut wrapped = [0u8; WRAPPED_KEY_LEN];
        wrapped.copy_from_slice(&bytes[10 + NONCE_PREFIX_LEN..]);

        Ok(Self {
            version,
            chunk_size,
            nonce_prefix,
            wrapped_content_key: WrappedKey::from_bytes(wrapped),
        })
    }
}

/// Byte offset of chunk `index` within an encrypted blob.
///
/// What makes seeking in an encrypted video cheap: jump here, decrypt one chunk.
pub fn chunk_offset(index: u32, chunk_size: u32) -> u64 {
    HEADER_LEN as u64 + u64::from(index) * (u64::from(chunk_size) + TAG_LEN as u64)
}

/// Encrypts `src` into `dst` under a fresh per-file content key.
pub fn encrypt_stream<R: Read, W: Write>(src: R, dst: W, vault_key: &VaultKey) -> Result<()> {
    let content_key = Key32::generate();
    let mut nonce_prefix = [0u8; NONCE_PREFIX_LEN];
    OsRng.fill_bytes(&mut nonce_prefix);
    let wrapped = vault_key.wrap_content_key(&content_key)?;

    encrypt_with(src, dst, &content_key, nonce_prefix, wrapped, CHUNK_SIZE)
}

/// Encryption with every random input supplied by the caller.
///
/// Only for test vectors, which must be byte-for-byte reproducible. Reusing a
/// `nonce_prefix` with the same content key destroys the security of both files.
pub(crate) fn encrypt_with<R: Read, W: Write>(
    mut src: R,
    mut dst: W,
    content_key: &Key32,
    nonce_prefix: [u8; NONCE_PREFIX_LEN],
    wrapped_content_key: WrappedKey,
    chunk_size: u32,
) -> Result<()> {
    let header = Header {
        version: VERSION,
        chunk_size,
        nonce_prefix,
        wrapped_content_key,
    };
    let header_bytes = header.to_bytes();
    dst.write_all(&header_bytes)?;

    let cipher = XChaCha20Poly1305::new(content_key.expose().into());
    let mut encryptor = Some(EncryptorBE32::from_aead(
        cipher,
        GenericArray::from_slice(&nonce_prefix),
    ));

    let chunk = chunk_size as usize;
    let mut current = vec![0u8; chunk];
    let mut lookahead = vec![0u8; chunk];

    // One chunk is always held back, because a chunk cannot be sealed until we
    // know whether anything follows it. An empty input still produces one final
    // chunk, so that decrypting an empty file yields an empty file rather than
    // an error.
    let mut filled = read_up_to(&mut src, &mut current)?;
    let mut sealed_chunks: u64 = 0;

    loop {
        let ahead = if filled == chunk {
            read_up_to(&mut src, &mut lookahead)?
        } else {
            0
        };

        if ahead == 0 {
            let enc = encryptor.take().expect("encryptor consumed twice");
            let out = enc
                .encrypt_last(Payload {
                    msg: &current[..filled],
                    aad: &header_bytes,
                })
                .map_err(|_| CryptoError::Decrypt)?;
            dst.write_all(&out)?;
            break;
        }

        let out = encryptor
            .as_mut()
            .expect("encryptor still present")
            .encrypt_next(Payload {
                msg: &current[..filled],
                aad: &header_bytes,
            })
            .map_err(|_| CryptoError::Decrypt)?;
        dst.write_all(&out)?;

        sealed_chunks += 1;
        if sealed_chunks >= u64::from(u32::MAX) {
            return Err(CryptoError::TooLarge);
        }

        std::mem::swap(&mut current, &mut lookahead);
        filled = ahead;
    }

    dst.flush()?;
    Ok(())
}

/// Decrypts a blob produced by [`encrypt_stream`].
///
/// Fails on a wrong key, a modified byte, a reordered chunk, a truncated file or
/// appended data. It never returns partially trusted output: a caller that gets
/// `Err` must discard everything already written to `dst`.
pub fn decrypt_stream<R: Read, W: Write>(
    mut src: R,
    mut dst: W,
    vault_key: &VaultKey,
) -> Result<()> {
    let mut header_bytes = [0u8; HEADER_LEN];
    read_exact_or_header_error(&mut src, &mut header_bytes)?;
    let header = Header::from_bytes(&header_bytes)?;

    let content_key = vault_key.unwrap_content_key(&header.wrapped_content_key)?;

    let cipher = XChaCha20Poly1305::new(content_key.expose().into());
    let mut decryptor = Some(DecryptorBE32::from_aead(
        cipher,
        GenericArray::from_slice(&header.nonce_prefix),
    ));

    let sealed_chunk = header.chunk_size as usize + TAG_LEN;
    let mut current = vec![0u8; sealed_chunk];
    let mut lookahead = vec![0u8; sealed_chunk];

    let mut filled = read_up_to(&mut src, &mut current)?;

    loop {
        // A sealed chunk is at least a tag. Anything shorter is malformed, and
        // slicing it would panic.
        if filled < TAG_LEN {
            return Err(CryptoError::Decrypt);
        }

        let ahead = if filled == sealed_chunk {
            read_up_to(&mut src, &mut lookahead)?
        } else {
            0
        };

        if ahead == 0 {
            let dec = decryptor.take().expect("decryptor consumed twice");
            let out = dec
                .decrypt_last(Payload {
                    msg: &current[..filled],
                    aad: &header_bytes,
                })
                .map_err(|_| CryptoError::Decrypt)?;
            dst.write_all(&out)?;
            break;
        }

        let out = decryptor
            .as_mut()
            .expect("decryptor still present")
            .decrypt_next(Payload {
                msg: &current[..filled],
                aad: &header_bytes,
            })
            .map_err(|_| CryptoError::Decrypt)?;
        dst.write_all(&out)?;

        std::mem::swap(&mut current, &mut lookahead);
        filled = ahead;
    }

    dst.flush()?;
    Ok(())
}

/// Fills `buf` as far as the reader allows, returning how many bytes landed.
///
/// `Read::read` is permitted to return less than asked for without being at the
/// end of the stream, and treating a short read as end-of-file would make the
/// final-chunk flag land on the wrong chunk.
fn read_up_to<R: Read>(src: &mut R, buf: &mut [u8]) -> Result<usize> {
    let mut total = 0;
    while total < buf.len() {
        match src.read(&mut buf[total..]) {
            Ok(0) => break,
            Ok(n) => total += n,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(e.into()),
        }
    }
    Ok(total)
}

fn read_exact_or_header_error<R: Read>(src: &mut R, buf: &mut [u8]) -> Result<()> {
    let read = read_up_to(src, buf)?;
    if read < buf.len() {
        return Err(CryptoError::Header("file is shorter than a header"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::aead::wrap_key_with_nonce;
    use crate::crypto::key::KEY_LEN;
    use crate::crypto::keyring::AAD_CONTENT_KEY;

    fn vault() -> VaultKey {
        VaultKey::from_key(Key32::from_bytes([0x21; KEY_LEN]))
    }

    fn roundtrip(plaintext: &[u8]) -> Vec<u8> {
        let vk = vault();
        let mut sealed = Vec::new();
        encrypt_stream(plaintext, &mut sealed, &vk).unwrap();

        let mut opened = Vec::new();
        decrypt_stream(sealed.as_slice(), &mut opened, &vk).unwrap();
        opened
    }

    #[test]
    fn header_round_trips() {
        let header = Header {
            version: VERSION,
            chunk_size: CHUNK_SIZE,
            nonce_prefix: [9u8; NONCE_PREFIX_LEN],
            wrapped_content_key: WrappedKey::from_bytes([3u8; WRAPPED_KEY_LEN]),
        };
        let parsed = Header::from_bytes(&header.to_bytes()).unwrap();
        assert_eq!(parsed.version, header.version);
        assert_eq!(parsed.chunk_size, header.chunk_size);
        assert_eq!(parsed.nonce_prefix, header.nonce_prefix);
        assert_eq!(parsed.wrapped_content_key, header.wrapped_content_key);
    }

    #[test]
    fn header_length_is_what_the_format_documents() {
        assert_eq!(HEADER_LEN, 101);
    }

    #[test]
    fn empty_input_round_trips() {
        assert_eq!(roundtrip(b""), b"");
    }

    #[test]
    fn small_input_round_trips() {
        let data = b"the vault holds what the disk gives away";
        assert_eq!(roundtrip(data), data);
    }

    /// The boundaries where an off-by-one in the chunking logic would show up.
    #[test]
    fn sizes_around_the_chunk_boundary_round_trip() {
        let chunk = CHUNK_SIZE as usize;
        for size in [
            0,
            1,
            TAG_LEN,
            chunk - 1,
            chunk,
            chunk + 1,
            chunk * 2 - 1,
            chunk * 2,
            chunk * 2 + 1,
        ] {
            let data: Vec<u8> = (0..size).map(|i| (i % 251) as u8).collect();
            assert_eq!(roundtrip(&data), data, "failed at size {size}");
        }
    }

    #[test]
    fn ciphertext_is_longer_than_plaintext_by_header_and_tags() {
        let vk = vault();
        let data = vec![0u8; CHUNK_SIZE as usize + 10];
        let mut sealed = Vec::new();
        encrypt_stream(data.as_slice(), &mut sealed, &vk).unwrap();
        // Two chunks, so two tags.
        assert_eq!(sealed.len(), HEADER_LEN + data.len() + 2 * TAG_LEN);
    }

    #[test]
    fn the_wrong_vault_key_fails() {
        let mut sealed = Vec::new();
        encrypt_stream(&b"secret"[..], &mut sealed, &vault()).unwrap();

        let wrong = VaultKey::from_key(Key32::from_bytes([0xFF; KEY_LEN]));
        let mut out = Vec::new();
        assert!(decrypt_stream(sealed.as_slice(), &mut out, &wrong).is_err());
    }

    #[test]
    fn encrypting_the_same_input_twice_gives_different_ciphertext() {
        let vk = vault();
        let mut a = Vec::new();
        let mut b = Vec::new();
        encrypt_stream(&b"same input"[..], &mut a, &vk).unwrap();
        encrypt_stream(&b"same input"[..], &mut b, &vk).unwrap();
        assert_ne!(a, b, "nonce prefix or content key is not random");
    }

    #[test]
    fn chunk_offsets_match_the_layout() {
        assert_eq!(chunk_offset(0, CHUNK_SIZE), HEADER_LEN as u64);
        assert_eq!(
            chunk_offset(1, CHUNK_SIZE),
            HEADER_LEN as u64 + CHUNK_SIZE as u64 + TAG_LEN as u64
        );
        // Must not overflow at the top of the counter range.
        let far = chunk_offset(u32::MAX, MAX_CHUNK_SIZE);
        assert!(far > 0);
    }

    /// A regression lock on the wire format.
    ///
    /// This does not prove XChaCha20-Poly1305 is correct; RustCrypto tests that
    /// against the specification. What it locks is everything this crate chose:
    /// the header layout, the field order and endianness, the AAD binding, and
    /// the nonce prefix length. Any of those drifting would silently break every
    /// vault already written, and this test is what stops that.
    #[test]
    fn wire_format_is_stable() {
        let content_key = Key32::from_bytes([0x11; KEY_LEN]);
        let vault_key = VaultKey::from_key(Key32::from_bytes([0x22; KEY_LEN]));
        let nonce_prefix = [0x33u8; NONCE_PREFIX_LEN];
        let wrap_nonce = [0x44u8; super::super::aead::NONCE_LEN];

        let wrapped =
            wrap_key_with_nonce(vault_key.raw(), &content_key, AAD_CONTENT_KEY, &wrap_nonce)
                .unwrap();

        let mut sealed = Vec::new();
        encrypt_with(
            &b"Keyblade wire format vector 001"[..],
            &mut sealed,
            &content_key,
            nonce_prefix,
            wrapped,
            MIN_CHUNK_SIZE,
        )
        .unwrap();

        assert_eq!(
            hex::encode(&sealed),
            WIRE_VECTOR_001,
            "the on-disk format changed; every existing vault would become unreadable"
        );

        // And the vector must still decrypt with the ordinary public path.
        let mut opened = Vec::new();
        decrypt_stream(sealed.as_slice(), &mut opened, &vault_key).unwrap();
        assert_eq!(opened, b"Keyblade wire format vector 001");
    }

    const WIRE_VECTOR_001: &str = "4b424c4401000010000033333333333333333333333333333333333333444444444444444444444444444444444444444444444444af5f0b6f79ebfa5f5c213e25d2f64d9959ed64a0d7fe0521844b98200b33eed187320fb253064d8a973d1dae1f4bc83c6a76c2c42f77094b619077f0926b7d77f9027b8fa4951b5626331da879b4ad4cf6d00e867dce50da0cb0f78d596ec7";
}

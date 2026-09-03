// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

//! Cryptographic core for Keyblade.
//!
//! This crate holds everything that touches a key. It has no knowledge of the
//! user interface, no knowledge of Tauri, and deliberately no networking
//! dependency of any kind.
//!
//! # Design
//!
//! The master password never encrypts data. It derives a [`MasterKey`] which
//! unwraps a randomly generated [`VaultKey`], and the vault key is what
//! everything else descends from. That indirection is what makes it possible to
//! change the master password, add Windows Hello, or revoke a recovery kit by
//! rewriting 32 bytes instead of re-encrypting the archive.
//!
//! ```text
//!   master password
//!         | Argon2id (calibrated, parameters stored in the vault header)
//!         v
//!    MasterKey  --unwraps-->  VaultKey  --BLAKE3 derive_key-->  subkeys
//! ```
//!
//! # What this crate does not do
//!
//! It does not invent primitives. Argon2id, XChaCha20-Poly1305 and BLAKE3 come
//! from established crates, and the STREAM chunking construction comes from
//! `aead::stream` rather than being written here. The judgement this crate
//! exercises is in composition and in refusing to tolerate malformed input.

#![forbid(unsafe_code)]
#![warn(missing_docs)]
#![warn(clippy::all)]

pub mod crypto;

pub use crypto::{
    aead::{unwrap_key, wrap_key, WrappedKey, WRAPPED_KEY_LEN},
    error::{CryptoError, Result},
    kdf::{calibrate, derive_master_key, KdfParams, SALT_LEN},
    key::Key32,
    keyring::{MasterKey, VaultKey},
    stream::{decrypt_stream, encrypt_stream, Header, CHUNK_SIZE, HEADER_LEN},
};

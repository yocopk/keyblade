// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

//! The command surface exposed to the web layer.
//!
//! Rules for everything added here, without exception:
//!
//! - Never return key material, in any form, however convenient.
//! - Never accept a filesystem path from the caller; resolve paths from the
//!   vault's own configuration instead.
//! - Validate every input at this boundary, before it reaches the core.
//! - Return errors that say what the user can do, never what an attacker could
//!   learn. A caller that can tell a wrong password from a corrupt file has an
//!   oracle.

use serde::Serialize;

/// Facts about the on-disk formats, for the About panel and for support.
///
/// Deliberately the first command: it carries nothing sensitive, and it proves
/// the application is linked against the cryptographic core rather than a stub.
#[derive(Debug, Serialize)]
pub struct CryptoInfo {
    /// Blob format version.
    pub format_version: u16,
    /// Serialised blob header length, in bytes.
    pub header_len: usize,
    /// Plaintext bytes per chunk.
    pub chunk_size: u32,
    /// Argon2id memory floor, in KiB.
    pub kdf_memory_floor_kib: u32,
    /// AEAD in use, for display.
    pub aead: &'static str,
    /// Key derivation function in use, for display.
    pub kdf: &'static str,
}

/// Returns the formats this build reads and writes.
#[tauri::command]
pub fn crypto_info() -> CryptoInfo {
    CryptoInfo {
        format_version: keyblade_core::crypto::stream::VERSION,
        header_len: keyblade_core::HEADER_LEN,
        chunk_size: keyblade_core::CHUNK_SIZE,
        kdf_memory_floor_kib: keyblade_core::crypto::kdf::MIN_M_COST_KIB,
        aead: "XChaCha20-Poly1305",
        kdf: "Argon2id",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crypto_info_reports_the_core_and_not_a_stub() {
        let info = crypto_info();
        assert_eq!(info.format_version, 1);
        assert_eq!(info.header_len, 101);
        assert_eq!(info.chunk_size, 1024 * 1024);
        assert_eq!(info.kdf_memory_floor_kib, 256 * 1024);
    }

    /// A regression guard with teeth: if a future command is tempted to return a
    /// key "just for debugging", this is the shape of the test that should stop
    /// it. CryptoInfo carries only public format facts.
    #[test]
    fn crypto_info_serialises_without_secrets() {
        let json = serde_json::to_string(&crypto_info()).unwrap();
        for forbidden in ["key", "secret", "password", "salt"] {
            assert!(
                !json.to_lowercase().contains(forbidden),
                "the IPC response mentions {forbidden:?}: {json}"
            );
        }
    }
}

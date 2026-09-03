// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

//! Error type for the cryptographic core.

/// Result alias used throughout this crate.
pub type Result<T> = core::result::Result<T, CryptoError>;

/// Everything that can go wrong in the cryptographic core.
///
/// [`CryptoError::Decrypt`] is deliberately opaque. A caller must not be able to
/// tell a wrong key from a corrupt tag from a truncated file, because that
/// distinction is exactly what an attacker probing a vault would like to have.
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum CryptoError {
    /// Authenticated decryption failed.
    ///
    /// The key is wrong, the data was modified, or the file was truncated. Which
    /// one is not reported, on purpose.
    #[error("decryption failed")]
    Decrypt,

    /// Key derivation parameters are outside the accepted range.
    #[error("invalid key derivation parameters: {0}")]
    Params(&'static str),

    /// The stream header is malformed.
    ///
    /// Carries a reason because a header is parsed before any key is involved,
    /// so the detail leaks nothing about secrets, and it makes corrupt files
    /// diagnosable.
    #[error("malformed header: {0}")]
    Header(&'static str),

    /// The plaintext would need more chunks than the 32-bit counter allows.
    #[error("input too large for the stream format")]
    TooLarge,

    /// Underlying I/O failure.
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

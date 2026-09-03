// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

//! Argon2id key derivation from the master password.
//!
//! Parameters are calibrated on the machine that creates the vault rather than
//! hardcoded, then stored in the vault header. A vault created on a fast desktop
//! therefore stays openable on a slow laptop, only more slowly, which is the
//! right trade-off: the alternative is either a weak floor everywhere or a vault
//! that cannot be opened on the hardware the user actually has with them.

use argon2::{Algorithm, Argon2, Params, Version};

use super::error::{CryptoError, Result};
use super::key::{Key32, KEY_LEN};

/// Length of the per-vault salt.
pub const SALT_LEN: usize = 16;

/// Serialised size of [`KdfParams`].
pub const KDF_PARAMS_LEN: usize = 12;

/// Lowest memory cost accepted, in KiB. 256 MiB.
///
/// A floor matters more than the calibrated target: it is what a vault gets on
/// the slowest machine that ever creates one.
pub const MIN_M_COST_KIB: u32 = 256 * 1024;

/// Highest memory cost accepted, in KiB. 4 GiB.
///
/// This is a denial-of-service guard, not a security parameter. Parameters are
/// read from a file that an attacker may have written, and without a ceiling a
/// crafted header could ask the process to allocate an arbitrary amount of
/// memory before a single byte is authenticated.
pub const MAX_M_COST_KIB: u32 = 4 * 1024 * 1024;

/// Default number of passes.
pub const DEFAULT_T_COST: u32 = 3;

/// Default degree of parallelism.
pub const DEFAULT_P_COST: u32 = 4;

/// Highest parallelism accepted. Also a denial-of-service guard.
pub const MAX_P_COST: u32 = 64;

/// Wall-clock time calibration aims for, in milliseconds.
pub const TARGET_MS: u128 = 1000;

/// Argon2id cost parameters for one vault.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KdfParams {
    /// Memory cost in KiB.
    pub m_cost_kib: u32,
    /// Number of passes.
    pub t_cost: u32,
    /// Degree of parallelism.
    pub p_cost: u32,
}

impl Default for KdfParams {
    fn default() -> Self {
        Self {
            m_cost_kib: MIN_M_COST_KIB,
            t_cost: DEFAULT_T_COST,
            p_cost: DEFAULT_P_COST,
        }
    }
}

impl KdfParams {
    /// Rejects parameters outside the accepted range.
    ///
    /// Always call this on parameters that came from a file.
    pub fn validate(&self) -> Result<()> {
        if self.m_cost_kib < MIN_M_COST_KIB {
            return Err(CryptoError::Params("memory cost below the 256 MiB floor"));
        }
        if self.m_cost_kib > MAX_M_COST_KIB {
            return Err(CryptoError::Params("memory cost above the 4 GiB ceiling"));
        }
        if self.t_cost == 0 {
            return Err(CryptoError::Params("pass count must be at least 1"));
        }
        if self.p_cost == 0 || self.p_cost > MAX_P_COST {
            return Err(CryptoError::Params("parallelism out of range"));
        }
        Ok(())
    }

    /// Serialises to 12 bytes, little-endian.
    pub fn to_bytes(self) -> [u8; KDF_PARAMS_LEN] {
        let mut out = [0u8; KDF_PARAMS_LEN];
        out[0..4].copy_from_slice(&self.m_cost_kib.to_le_bytes());
        out[4..8].copy_from_slice(&self.t_cost.to_le_bytes());
        out[8..12].copy_from_slice(&self.p_cost.to_le_bytes());
        out
    }

    /// Parses 12 bytes and validates the result.
    pub fn from_bytes(bytes: &[u8; KDF_PARAMS_LEN]) -> Result<Self> {
        let params = Self {
            m_cost_kib: u32::from_le_bytes(bytes[0..4].try_into().expect("4 bytes")),
            t_cost: u32::from_le_bytes(bytes[4..8].try_into().expect("4 bytes")),
            p_cost: u32::from_le_bytes(bytes[8..12].try_into().expect("4 bytes")),
        };
        params.validate()?;
        Ok(params)
    }
}

/// Derives the master key from the password and the vault salt.
pub fn derive_master_key(
    password: &[u8],
    salt: &[u8; SALT_LEN],
    params: KdfParams,
) -> Result<Key32> {
    params.validate()?;

    let argon_params = Params::new(
        params.m_cost_kib,
        params.t_cost,
        params.p_cost,
        Some(KEY_LEN),
    )
    .map_err(|_| CryptoError::Params("rejected by argon2"))?;

    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon_params);

    let mut out = [0u8; KEY_LEN];
    argon
        .hash_password_into(password, salt, &mut out)
        .map_err(|_| CryptoError::Params("derivation failed"))?;

    let key = Key32::from_bytes(out);
    // `out` is a plain array and does not zeroise itself.
    zeroize::Zeroize::zeroize(&mut out);
    Ok(key)
}

/// Measures the machine and returns the strongest parameters that stay under
/// [`TARGET_MS`], never going below [`MIN_M_COST_KIB`].
///
/// Run once, when a vault is created. It costs several seconds by construction.
pub fn calibrate() -> KdfParams {
    let mut params = KdfParams::default();
    let salt = [0u8; SALT_LEN];

    loop {
        let start = std::time::Instant::now();
        if derive_master_key(b"calibration probe", &salt, params).is_err() {
            return KdfParams::default();
        }
        let elapsed = start.elapsed().as_millis();

        // Already at or past the target: this is the answer.
        if elapsed >= TARGET_MS {
            return params;
        }
        // Doubling would overshoot the ceiling: stop here.
        let doubled = params.m_cost_kib.saturating_mul(2);
        if doubled > MAX_M_COST_KIB {
            return params;
        }
        // Doubling memory roughly doubles the time. If the measured time is so
        // far below target that even doubling stays under half of it, keep
        // going; otherwise accept the current value rather than overshoot.
        params.m_cost_kib = doubled;
        if elapsed * 2 >= TARGET_MS {
            return params;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Parameters small enough for a test to finish quickly. Never use these for
    /// a real vault; `validate` rejects them, which is the point of the floor.
    fn weak() -> KdfParams {
        KdfParams {
            m_cost_kib: MIN_M_COST_KIB,
            t_cost: 1,
            p_cost: 1,
        }
    }

    #[test]
    fn derivation_is_deterministic() {
        let salt = [0x11u8; SALT_LEN];
        let a = derive_master_key(b"correct horse battery staple", &salt, weak()).unwrap();
        let b = derive_master_key(b"correct horse battery staple", &salt, weak()).unwrap();
        assert!(a.ct_eq(&b));
    }

    #[test]
    fn a_different_password_gives_a_different_key() {
        let salt = [0x11u8; SALT_LEN];
        let a = derive_master_key(b"correct horse battery staple", &salt, weak()).unwrap();
        let b = derive_master_key(b"correct horse battery stapl3", &salt, weak()).unwrap();
        assert!(!a.ct_eq(&b));
    }

    #[test]
    fn a_different_salt_gives_a_different_key() {
        let a = derive_master_key(b"same password", &[0x11u8; SALT_LEN], weak()).unwrap();
        let b = derive_master_key(b"same password", &[0x12u8; SALT_LEN], weak()).unwrap();
        assert!(!a.ct_eq(&b), "salt is not reaching the KDF");
    }

    #[test]
    fn params_round_trip_through_bytes() {
        let params = KdfParams {
            m_cost_kib: 512 * 1024,
            t_cost: 4,
            p_cost: 8,
        };
        let parsed = KdfParams::from_bytes(&params.to_bytes()).unwrap();
        assert_eq!(params, parsed);
    }

    #[test]
    fn params_below_the_memory_floor_are_rejected() {
        let weak_params = KdfParams {
            m_cost_kib: 8,
            t_cost: 1,
            p_cost: 1,
        };
        assert!(weak_params.validate().is_err());
        assert!(KdfParams::from_bytes(&weak_params.to_bytes()).is_err());
    }

    /// A header is attacker-controlled input. Without a ceiling, this value
    /// would ask the allocator for 4 TiB before anything is authenticated.
    #[test]
    fn absurd_memory_cost_from_a_hostile_header_is_rejected() {
        let hostile = KdfParams {
            m_cost_kib: u32::MAX,
            t_cost: 1,
            p_cost: 1,
        };
        assert!(KdfParams::from_bytes(&hostile.to_bytes()).is_err());
    }

    #[test]
    fn absurd_parallelism_from_a_hostile_header_is_rejected() {
        let hostile = KdfParams {
            m_cost_kib: MIN_M_COST_KIB,
            t_cost: 1,
            p_cost: u32::MAX,
        };
        assert!(KdfParams::from_bytes(&hostile.to_bytes()).is_err());
    }

    #[test]
    fn zero_pass_count_is_rejected() {
        let hostile = KdfParams {
            m_cost_kib: MIN_M_COST_KIB,
            t_cost: 0,
            p_cost: 1,
        };
        assert!(KdfParams::from_bytes(&hostile.to_bytes()).is_err());
    }

    #[test]
    fn default_params_are_valid() {
        KdfParams::default().validate().unwrap();
    }

    #[test]
    #[ignore = "takes several seconds by design; run with --ignored"]
    fn calibration_returns_usable_params() {
        let params = calibrate();
        params.validate().unwrap();
        assert!(params.m_cost_kib >= MIN_M_COST_KIB);
        assert!(params.m_cost_kib <= MAX_M_COST_KIB);
    }
}

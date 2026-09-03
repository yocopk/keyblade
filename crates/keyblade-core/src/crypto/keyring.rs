// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

//! The vault key hierarchy.
//!
//! The master password does not encrypt anything. It derives a [`MasterKey`],
//! which unwraps a randomly generated [`VaultKey`], and every other key in the
//! system descends from the vault key.
//!
//! The reason is operational rather than cryptographic: changing the master
//! password, enrolling Windows Hello or revoking a recovery kit each rewrite a
//! single wrapped key, 72 bytes, instead of re-encrypting the archive. A design
//! that derived the data key straight from the password would make changing that
//! password proportional to the size of the vault, which in practice means users
//! never change it.

use super::aead::{unwrap_key, wrap_key, WrappedKey};
use super::error::Result;
use super::kdf::{derive_master_key, KdfParams, SALT_LEN};
use super::key::{Key32, KEY_LEN};

/// Domain separation for BLAKE3 key derivation.
///
/// These strings are part of the on-disk format. Changing one makes every
/// existing vault underivable, so they carry a date and a version and are never
/// edited in place: a new purpose gets a new constant.
const CTX_DATABASE: &str = "keyblade 2026-09-03 vault database key v1";
const CTX_SEARCH_INDEX: &str = "keyblade 2026-09-03 search index key v1";

/// Associated data binding a wrapped vault key to its role.
const AAD_VAULT_KEY: &[u8] = b"keyblade:vault-key:v1";

/// Associated data binding a wrapped per-file content key to its role.
pub(crate) const AAD_CONTENT_KEY: &[u8] = b"keyblade:content-key:v1";

/// The key derived from the master password.
///
/// Its only job is to unwrap the vault key. It never encrypts user data, so a
/// change of password does not touch anything else.
pub struct MasterKey(Key32);

impl MasterKey {
    /// Derives the master key from a password and the vault salt.
    pub fn derive(password: &[u8], salt: &[u8; SALT_LEN], params: KdfParams) -> Result<Self> {
        Ok(Self(derive_master_key(password, salt, params)?))
    }

    /// Wraps an existing vault key under this master key.
    ///
    /// Used when creating a vault and when changing the master password.
    pub fn wrap_vault_key(&self, vault_key: &VaultKey) -> Result<WrappedKey> {
        wrap_key(&self.0, &vault_key.0, AAD_VAULT_KEY)
    }

    /// Recovers the vault key. Fails if the password was wrong.
    pub fn unwrap_vault_key(&self, wrapped: &WrappedKey) -> Result<VaultKey> {
        Ok(VaultKey(unwrap_key(&self.0, wrapped, AAD_VAULT_KEY)?))
    }
}

impl core::fmt::Debug for MasterKey {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("MasterKey(<redacted>)")
    }
}

/// The root key of a vault.
///
/// Generated once from the system CSPRNG and never derived from a password.
pub struct VaultKey(Key32);

impl VaultKey {
    /// Generates a new vault key. Called exactly once per vault, at creation.
    pub fn generate() -> Self {
        Self(Key32::generate())
    }

    /// Reconstructs from raw bytes. For tests and for callers that already hold
    /// unwrapped key material.
    pub fn from_key(key: Key32) -> Self {
        Self(key)
    }

    /// Subkey for the encrypted metadata database.
    pub fn database_key(&self) -> Key32 {
        self.derive_subkey(CTX_DATABASE)
    }

    /// Subkey for the encrypted search index.
    pub fn search_index_key(&self) -> Key32 {
        self.derive_subkey(CTX_SEARCH_INDEX)
    }

    /// Wraps a per-file content key.
    pub fn wrap_content_key(&self, content_key: &Key32) -> Result<WrappedKey> {
        wrap_key(&self.0, content_key, AAD_CONTENT_KEY)
    }

    /// Recovers a per-file content key.
    pub fn unwrap_content_key(&self, wrapped: &WrappedKey) -> Result<Key32> {
        unwrap_key(&self.0, wrapped, AAD_CONTENT_KEY)
    }

    /// Borrows the raw vault key. Restricted to this crate on purpose.
    ///
    /// Currently only the test suite calls this. M1 needs it to open the
    /// SQLCipher connection, so it stays rather than being reintroduced later.
    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn raw(&self) -> &Key32 {
        &self.0
    }

    fn derive_subkey(&self, context: &str) -> Key32 {
        // BLAKE3's derive_key is a KDF with built-in domain separation. The
        // context string is the domain, which is why the constants above are
        // long, dated and unique.
        let mut out: [u8; KEY_LEN] = blake3::derive_key(context, self.0.expose());
        let key = Key32::from_bytes(out);
        zeroize::Zeroize::zeroize(&mut out);
        key
    }
}

impl core::fmt::Debug for VaultKey {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("VaultKey(<redacted>)")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fast_params() -> KdfParams {
        KdfParams {
            m_cost_kib: super::super::kdf::MIN_M_COST_KIB,
            t_cost: 1,
            p_cost: 1,
        }
    }

    const SALT: [u8; SALT_LEN] = [0x42; SALT_LEN];

    #[test]
    fn the_full_unlock_path_works() {
        let vault_key = VaultKey::generate();
        let master = MasterKey::derive(b"a decent master password", &SALT, fast_params()).unwrap();
        let wrapped = master.wrap_vault_key(&vault_key).unwrap();

        // A later session: same password, same salt, same vault key.
        let master_again =
            MasterKey::derive(b"a decent master password", &SALT, fast_params()).unwrap();
        let recovered = master_again.unwrap_vault_key(&wrapped).unwrap();

        assert!(vault_key.raw().ct_eq(recovered.raw()));
    }

    #[test]
    fn the_wrong_password_does_not_open_the_vault() {
        let vault_key = VaultKey::generate();
        let master = MasterKey::derive(b"right password", &SALT, fast_params()).unwrap();
        let wrapped = master.wrap_vault_key(&vault_key).unwrap();

        let wrong = MasterKey::derive(b"wrong password", &SALT, fast_params()).unwrap();
        assert!(wrong.unwrap_vault_key(&wrapped).is_err());
    }

    /// The whole point of the indirection: a new password, the same vault key,
    /// and nothing else on disk has to change.
    #[test]
    fn changing_the_master_password_preserves_the_vault_key() {
        let vault_key = VaultKey::generate();

        let old = MasterKey::derive(b"old password", &SALT, fast_params()).unwrap();
        let wrapped_old = old.wrap_vault_key(&vault_key).unwrap();

        // Re-wrap under the new password. No file content is touched.
        let unlocked = old.unwrap_vault_key(&wrapped_old).unwrap();
        let new = MasterKey::derive(b"new password", &SALT, fast_params()).unwrap();
        let wrapped_new = new.wrap_vault_key(&unlocked).unwrap();

        let reopened = MasterKey::derive(b"new password", &SALT, fast_params())
            .unwrap()
            .unwrap_vault_key(&wrapped_new)
            .unwrap();

        assert!(vault_key.raw().ct_eq(reopened.raw()));

        // And the old password no longer opens the new wrapping.
        assert!(old.unwrap_vault_key(&wrapped_new).is_err());
    }

    #[test]
    fn subkeys_are_distinct_from_each_other_and_from_the_vault_key() {
        let vault_key = VaultKey::generate();
        let db = vault_key.database_key();
        let index = vault_key.search_index_key();

        assert!(!db.ct_eq(&index), "two purposes derived the same key");
        assert!(!db.ct_eq(vault_key.raw()), "subkey equals the vault key");
        assert!(!index.ct_eq(vault_key.raw()), "subkey equals the vault key");
    }

    #[test]
    fn subkey_derivation_is_deterministic() {
        let vault_key = VaultKey::from_key(Key32::from_bytes([7u8; KEY_LEN]));
        assert!(vault_key.database_key().ct_eq(&vault_key.database_key()));
    }

    /// A wrapped vault key must not be usable as a content key, or the other way
    /// round. This is what the associated-data binding buys.
    #[test]
    fn wrapped_keys_cannot_be_swapped_between_roles() {
        let vault_key = VaultKey::generate();
        let master = MasterKey::derive(b"password", &SALT, fast_params()).unwrap();

        let content_key = Key32::generate();
        let wrapped_content = vault_key.wrap_content_key(&content_key).unwrap();
        let wrapped_vault = master.wrap_vault_key(&vault_key).unwrap();

        assert!(
            master.unwrap_vault_key(&wrapped_content).is_err(),
            "a content key was accepted as a vault key"
        );
        assert!(
            vault_key.unwrap_content_key(&wrapped_vault).is_err(),
            "a vault key was accepted as a content key"
        );
    }

    #[test]
    fn debug_output_never_leaks_key_material() {
        let vault_key = VaultKey::generate();
        let master = MasterKey::derive(b"password", &SALT, fast_params()).unwrap();
        assert_eq!(format!("{vault_key:?}"), "VaultKey(<redacted>)");
        assert_eq!(format!("{master:?}"), "MasterKey(<redacted>)");
    }
}

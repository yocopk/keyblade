// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

//! Feeds arbitrary bytes to the full decryption path under a fixed key.
//!
//! Decryption must fail cleanly on anything that is not a genuine blob. What
//! this hunts for is a panic: an out-of-range slice, an arithmetic overflow, or
//! an allocation driven by an attacker-supplied length. A panic here is a
//! denial-of-service in the application and, with `panic = "abort"`, a crash
//! that could produce a dump containing key material.

#![no_main]

use keyblade_core::{decrypt_stream, Key32, VaultKey};
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    let vault_key = VaultKey::from_key(Key32::from_bytes([0x5A; 32]));
    let mut out = Vec::new();
    // The result is irrelevant. Not panicking is the property under test.
    let _ = decrypt_stream(data, &mut out, &vault_key);
});

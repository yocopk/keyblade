// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

//! The Keyblade desktop application.
//!
//! This crate is the application shell: window lifecycle, the IPC surface, and
//! (from M1) the vault and Windows-specific hardening. Everything that touches a
//! key lives in `keyblade-core`, which is a separate crate precisely so that it
//! can keep `#![forbid(unsafe_code)]` once the Windows integration arrives here.
//!
//! # The IPC boundary
//!
//! Commands in [`ipc`] are the only surface the web layer can reach, and they
//! are treated the way a public HTTP endpoint is treated: every input validated,
//! no arbitrary filesystem paths accepted, and **no key material returned**. If
//! the WebView is ever compromised, the attacker gets what is on screen, not the
//! vault.

pub mod ipc;

/// Builds and runs the application.
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ipc::crypto_info])
        .run(tauri::generate_context!())
        .expect("Keyblade failed to start");
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

// No console window in release. In debug it stays, because Rust panics and
// tracing output are worth more during development than a clean taskbar.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    keyblade_lib::run();
}

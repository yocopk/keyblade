// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

//! The header parser is the only code that interprets untrusted bytes before a
//! key is involved, which makes it the highest-value fuzzing target in the crate.
//! Any input must produce Ok or Err, never a panic.

#![no_main]

use keyblade_core::{Header, HEADER_LEN};
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if data.len() < HEADER_LEN {
        return;
    }
    let bytes: &[u8; HEADER_LEN] = data[..HEADER_LEN].try_into().expect("length checked");

    if let Ok(header) = Header::from_bytes(bytes) {
        // A header that parsed must round-trip to the same bytes. If it does
        // not, two different byte strings map to one header, and the associated
        // data binding would no longer be unambiguous.
        assert_eq!(&header.to_bytes(), bytes);
    }
});

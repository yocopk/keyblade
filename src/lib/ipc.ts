// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

/**
 * The typed boundary to the Rust core.
 *
 * Every call into Tauri goes through this module, so there is exactly one place
 * where the command names and their shapes are written down. Components never
 * call `invoke` directly.
 *
 * Nothing here ever receives key material: the Rust side returns decrypted
 * values for the item that was asked for, never a key. See `src-tauri/src/ipc`.
 */

import { invoke } from "@tauri-apps/api/core";

/** Formats this build reads and writes. Mirrors `ipc::CryptoInfo` in Rust. */
export interface CryptoInfo {
  formatVersion: number;
  headerLen: number;
  chunkSize: number;
  kdfMemoryFloorKib: number;
  aead: string;
  kdf: string;
}

/** Raw shape as serialised by serde, which uses the Rust field names. */
interface CryptoInfoWire {
  format_version: number;
  header_len: number;
  chunk_size: number;
  kdf_memory_floor_kib: number;
  aead: string;
  kdf: string;
}

/** Reads the cryptographic format facts, for the About panel. */
export async function getCryptoInfo(): Promise<CryptoInfo> {
  const wire = await invoke<CryptoInfoWire>("crypto_info");
  return {
    formatVersion: wire.format_version,
    headerLen: wire.header_len,
    chunkSize: wire.chunk_size,
    kdfMemoryFloorKib: wire.kdf_memory_floor_kib,
    aead: wire.aead,
    kdf: wire.kdf,
  };
}

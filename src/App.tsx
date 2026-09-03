// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

/**
 * Application shell.
 *
 * Placeholder. This renders enough to prove the web layer is wired to the Rust
 * core and that the design tokens are loading, and it is replaced wholesale
 * when the Keyblade design is translated in (the lock screen and the command
 * menu). Nothing here is meant to survive that.
 */

import { useEffect, useState } from "react";

import { getCryptoInfo, type CryptoInfo } from "./lib/ipc";

export function App() {
  const [info, setInfo] = useState<CryptoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCryptoInfo()
      .then(setInfo)
      .catch(() => setError("Could not reach the cryptographic core."));
  }, []);

  return (
    <main
      style={{
        display: "grid",
        placeContent: "center",
        gap: "var(--space-6)",
        height: "100%",
        padding: "var(--space-8)",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-display)",
          margin: 0,
          letterSpacing: "0.01em",
        }}
      >
        Keyblade
      </h1>

      <p style={{ color: "var(--muted)", margin: 0, maxWidth: "42ch" }}>
        Application shell. The vault, the lock screen and the command menu are
        not built yet.
      </p>

      {error !== null && (
        <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>
      )}

      {info !== null && (
        <dl
          data-selectable
          style={{
            display: "grid",
            gridTemplateColumns: "auto auto",
            gap: "var(--space-2) var(--space-6)",
            margin: 0,
            padding: "var(--space-4) var(--space-6)",
            border: "var(--border-hairline) solid var(--edge)",
            background: "var(--abyss)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-sm)",
            textAlign: "left",
          }}
        >
          <dt style={{ color: "var(--faint)" }}>Key derivation</dt>
          <dd style={{ margin: 0, color: "var(--gold)" }}>{info.kdf}</dd>
          <dt style={{ color: "var(--faint)" }}>Encryption</dt>
          <dd style={{ margin: 0, color: "var(--gold)" }}>{info.aead}</dd>
          <dt style={{ color: "var(--faint)" }}>Blob format</dt>
          <dd style={{ margin: 0, color: "var(--gold)" }}>
            v{info.formatVersion}, {info.headerLen} B header
          </dd>
          <dt style={{ color: "var(--faint)" }}>Memory floor</dt>
          <dd style={{ margin: 0, color: "var(--gold)" }}>
            {info.kdfMemoryFloorKib / 1024} MiB
          </dd>
        </dl>
      )}
    </main>
  );
}

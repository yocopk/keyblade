<div align="center">

# Keyblade

**An offline, encrypted vault for passwords, documents, images and video.**

No network. No account. No cloud. No telemetry.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-E8C170.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0E1628.svg)](#building)
[![Status](https://img.shields.io/badge/status-pre--alpha-A93726.svg)](#status)

</div>

---

> [!WARNING]
> **Pre-alpha. Not independently audited. Do not put irreplaceable secrets in it yet.**
>
> The cryptography is documented in [`docs/CRYPTO-SPEC.md`](docs/CRYPTO-SPEC.md) and
> covered by test vectors, but no security professional outside this project has
> reviewed it. Until that happens, treat it as a work in progress.

## What it is

A desktop vault that keeps everything on your machine and nowhere else. It stores
passwords the way a password manager does, and alongside them the things password
managers usually refuse: scans of your ID, contracts, recovery codes on paper,
photos, video.

Files are not merely stored encrypted, they are *viewed* encrypted. Images, PDFs and
video open inside the application, decrypted in streaming, so a plaintext copy never
touches the disk.

## What it is not

It is not a sync service, and it never will be. There is no server to trust, because
there is no server. That is the entire point, and it is also the trade-off: your
backups are your responsibility.

**It is not protection against malware.** If something is running on your machine as
you while the vault is open, it can see what you see. No desktop password manager
defends against that, whatever its marketing says. Keyblade is built so that a
machine you no longer control is useless to whoever has it. Read
[`SECURITY.md`](SECURITY.md) before deciding whether that is the guarantee you need.

## How it works

| | |
| --- | --- |
| **Key derivation** | Argon2id, calibrated at vault creation to ~1s on your machine, 256 MiB floor |
| **Encryption** | XChaCha20-Poly1305, 192-bit nonces, safe to generate randomly |
| **Key hierarchy** | The master password unwraps a random vault key. Changing the password rewrites 32 bytes, not your archive |
| **Large files** | STREAM chunked AEAD, 1 MiB chunks, truncation detected via an explicit final-chunk marker |
| **Metadata** | Filenames, sizes, dates and folder structure are encrypted too |
| **Unlock** | Master password, optionally Windows Hello for quick re-entry |
| **Recovery** | Optional 24-word recovery kit, off by default |

Full design: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) &middot;
[`docs/CRYPTO-SPEC.md`](docs/CRYPTO-SPEC.md) &middot;
[`docs/FILE-FORMAT.md`](docs/FILE-FORMAT.md) &middot;
[`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md)

## Verifying the no-network claim

Saying an application is offline is worth nothing. Four things make it checkable:

1. Content-Security-Policy sets `connect-src 'none'`; no Tauri `http`, `shell` or
   `updater` plugin is enabled. Fonts and assets ship inside the binary, with **no
   CDN**.
2. `cargo-deny` fails the build if any networking crate enters the dependency graph,
   including transitively.
3. CI runs the application and asserts the process opens no sockets.
4. Builds are reproducible: compile the tag yourself and compare the hash against the
   published release.

## Status

Pre-alpha, under active development.

- [x] **M0** Cryptographic core: key hierarchy, Argon2id, STREAM, test vectors
- [x] **M0.5** Application shell: Tauri 2 workspace, React frontend, design tokens
- [x] **M3** Interface: the stained-glass lock screen and the command menu
- [ ] **M1** Minimum vault: password CRUD, search, auto-lock, sealed clipboard
- [ ] **M2** Files: import, image and PDF viewers, video player with seek, export
- [ ] **M4** Recovery kit, Windows Hello, importers, encrypted backup
- [ ] **M5** Reproducible build, signing, SBOM, 0.1.0

The interface arrived before the vault, out of the intended order. It runs on
sample data, labelled as such in the list header: nothing is stored, nothing is
encrypted, and unlocking is a timer of roughly the length Argon2id actually
takes. M1 replaces the data source; the components are built around the seams it
needs. See [`docs/DESIGN-DECISIONS.md`](docs/DESIGN-DECISIONS.md).

## Building

Requires [Rust](https://rustup.rs) (stable-msvc), [Node](https://nodejs.org) 20+,
pnpm, and Visual Studio Build Tools with the C++ workload.

```bash
pnpm install
pnpm tauri dev
```

Run the whole Rust workspace, or just the cryptographic core:

```bash
cargo test --workspace
cargo test -p keyblade-core
```

The core is a separate crate from the application on purpose: it forbids unsafe
code outright, and that guarantee has to survive the Windows integration
(Hello, DPAPI, capture exclusion), which cannot be written without it. It also
means the cryptography can be read and audited without untangling it from
application plumbing.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md). Contributions require agreeing to the
[CLA](CLA.md). Security issues go through private reporting, never a public issue.
See [`SECURITY.md`](SECURITY.md).

## Licence

[AGPL-3.0-only](LICENSE). Copyright (C) 2026 Andrea Marchese.

Anyone may use, study, modify and redistribute this software. Anyone who distributes
it, or runs a modified version as a network service, must publish their source under
the same licence.

**The name and the visual identity are not covered by the AGPL.** Forks are welcome
and must use a different name and icon, see [`TRADEMARKS.md`](TRADEMARKS.md). For a
program that guards secrets, that restriction is a security measure: nobody should be
able to install a modified build believing it is this one.

## Disclaimer

Keyblade is an independent, unofficial project, not affiliated with, endorsed by or
associated with Square Enix Holdings Co., Ltd. or The Walt Disney Company.

No assets from the KINGDOM HEARTS series, including artwork, sprites, textures,
fonts, audio, music, and character, world or weapon names, are included in or
distributed with this software. Every graphic is original work made for this project.
KINGDOM HEARTS and related marks belong to their respective owners.

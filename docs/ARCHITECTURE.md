# Architecture

Design decisions and the reasoning behind them. For the cryptography see
[`CRYPTO-SPEC.md`](CRYPTO-SPEC.md); for the blob layout see
[`FILE-FORMAT.md`](FILE-FORMAT.md); for what is and is not defended see
[`THREAT-MODEL.md`](THREAT-MODEL.md).

## Locked decisions

Eight choices the project is built on. Revisiting any of them means redesigning
around it, so they are recorded here with the reason rather than left implicit.

| Decision | Reason |
| --- | --- |
| **Tauri 2**, Rust core with a web UI | Keys live in Rust, where memory can actually be zeroised and pages locked. A ~10 MB binary on the system WebView instead of a bundled Chromium and Node runtime, which is a much smaller attack surface for a program holding secrets |
| **Windows 10/11 only** for v1 | One target means the time goes into security and interface rather than CI. It also unlocks Windows Hello, DPAPI and capture exclusion, which have no portable equivalent and which most cross-platform vaults skip |
| **AGPL-3.0-only** | The strongest copyleft available under an OSI licence. A fork, or a network service built on it, has to publish its source |
| **Optional recovery kit**, off by default | Losing a master password should be recoverable for anyone who consciously accepts a second secret existing, and impossible for anyone who does not. Forcing either choice on everyone is wrong |
| **Master password plus optional Windows Hello** | Hello is what makes a long master password tolerable in daily use. It is always a shortcut, never a replacement: the password stays the only root of trust |
| **Internal viewer, streaming** | A vault whose files must be exported to be read is a zip archive with extra steps. The point is that a plaintext copy never reaches the disk |
| **Stained-glass lock screen, command-menu application** | Two moments, two treatments. The lock screen is seen for three seconds and can be ceremonial; the application is used for hours and has to be legible |
| **No network, ever** | Not a feature to be added later. It is the property everything else is arranged around, and it is what makes the design checkable |

## Process boundary

```
┌─ WebView ──────────────────────────────┐
│  scenes, components, styling           │   never sees a key
│  receives decrypted values for the     │
│  one item it asked for                 │
└──────────────┬─────────────────────────┘
               │  Tauri IPC, explicit allowlist
┌──────────────▼─────────────────────────┐
│  Rust                                  │
│  ipc/       validated command surface  │
│  vault/     header, database, blobs    │
│  crypto/    keys never leave here      │
│  platform/  Windows-specific hardening │
└────────────────────────────────────────┘
```

**No key material crosses the IPC boundary.** The frontend asks for an item and
receives its decrypted value; it never receives the vault key, a subkey or a
content key. If the WebView is compromised, the attacker gets what is currently
on screen, not the vault.

`ipc/` is treated the way a public HTTP endpoint is treated: every command
validates its input, none accepts an arbitrary filesystem path, none returns
cryptographic material.

## On-disk layout

```
%APPDATA%\Keyblade\
├── vault.kbld      header: Argon2 parameters, salt, wrapped copies of the vault key
├── index.db        SQLCipher: passwords, notes, tags, filenames, folder structure
├── index.db-wal
└── blobs\
    ├── 3f\ 3f9a2c1e….kb
    └── a1\ a17e0433….kb
```

### Blob names are random, not content hashes

Content-addressed storage would be tidier and would deduplicate. It would also
let anyone who can see the folder test whether the vault contains a specific
known file, by hashing a candidate and looking for it. That is a silent
confirmation leak, so blob names are random UUIDs and deduplication is given up.

Two hex characters of sharding keep directories from reaching six figures of
entries, which Explorer and NTFS both handle badly.

### What SQLCipher does and does not hide

It encrypts pages. It does not hide the size of the database or the pattern of
access, so someone watching the folder over time can estimate how many items
exist and when they are used. This is an accepted limitation, recorded here
rather than left for someone to discover.

Filenames, extensions, MIME types, sizes and dates are inside the database, not
in the filesystem, so the folder itself reveals only the count and approximate
size of the blobs.

### Padding

Blob size bounds the plaintext length. An option to round each blob up to the
next MiB will close that at the cost of wasted space. Off by default, because
most users do not need it and all users would pay for it.

## Streaming, not buffering

An 8 GiB video cannot be held in memory to be authenticated, and a player must
be able to seek without decrypting everything before the target. Both fall out
of chunking: `chunk_offset()` gives the position of any chunk, so a seek costs
one decryption.

The trade-off is stated in [`FILE-FORMAT.md`](FILE-FORMAT.md): a seek proves the
chunk is genuine and correctly positioned, not that the file is complete. Only a
sequential read gets truncation detection.

## Auto-lock

Locking must not depend on the user remembering to lock. Triggers:

- Idle timeout, five minutes by default
- Windows session lock, via `WM_WTSSESSION_CHANGE`
- Suspend and hibernate
- Window minimised, optional

On lock: every key zeroised, the SQLCipher connection closed, the decryption
cache dropped. Returning requires the master password or Windows Hello.

## Build sequence

The cryptographic core is written and tested before any interface exists. A
correct crypto layer under an ugly interface is two weeks of design work away
from being good; a beautiful interface over a broken crypto layer is thrown away.

M0 is complete: 55 tests, a committed wire-format vector, two fuzz targets, and
CI enforcing formatting, clippy, tests, documentation and the banned-dependency
list. M1 onwards is tracked in the README.

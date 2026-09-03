# Threat model

[`SECURITY.md`](../SECURITY.md) carries the summary and the reporting process.
This is the working version: what is being protected, from whom, what each
defence actually buys, and what remains exposed afterwards.

It is binding. A report about something under **Defended** is a bug. Something
under **Out of scope** is a documented limitation, not a vulnerability, and
saying so up front is what makes the rest of the document worth anything.

## Assets

Ranked by what their loss costs, which is not the same as how secret they feel.

| Asset | Where it lives | Loss means |
| --- | --- | --- |
| Master password | The user's memory only | Total compromise. Never stored, never transmitted, never logged |
| Vault key | Memory while unlocked; wrapped on disk | Total compromise of the vault, without the password |
| Stored credentials | `index.db`, SQLCipher | Account takeover across every service in the vault |
| Documents, images, video | `blobs\`, chunked AEAD | Identity documents and contracts: irreversible disclosure |
| Metadata | `index.db` | Filenames and structure alone reveal a great deal. Encrypted for that reason |
| Existence of a vault | Filesystem | Accepted as visible. Deniability is not offered |

## Adversaries

### A1 — Opportunistic thief

Steals the laptop or buys the drive secondhand. No specific interest in this
user, no cryptographic capability.

**Defended.** Everything at rest is encrypted under a key derived from the master
password with Argon2id at a 256 MiB floor. The drive is worth its resale value
and nothing else. *This is the adversary Keyblade is really built for, and the
most likely one to actually occur.*

### A2 — Forensic examiner with the drive

A capable examiner with the disk image, unlimited time, and standard tooling.
Not able to break XChaCha20-Poly1305.

**Mostly defended.** No plaintext temporaries, no plaintext cache, no key
material in the page file, blob names that reveal nothing about contents.

**Residual:** the number and approximate size of blobs, the size of the database,
and file timestamps are visible. That the user has a Keyblade vault is visible.
An examiner learns roughly how much is stored and when it was last touched.
Optional padding narrows the size channel; nothing hides the vault's existence.

### A3 — Someone with brief physical access

Access to the machine while the user is away. Session locked or the vault
locked.

**Defended**, conditionally. Auto-lock fires on idle, on Windows session lock and
on suspend, and zeroises keys as it goes. The condition is that the vault was
actually locked: if it was left open on an unlocked session, this adversary is
A5 and wins.

### A4 — Another user on the same machine

A separate Windows account, without administrator rights.

**Defended** by file encryption. Windows ACLs are a second layer, not the first,
since an administrator can override them and this project does not assume they
cannot.

### A5 — Malware running as the user

An infostealer, keylogger or RAT with the user's privileges while the vault is
**unlocked**.

**Not defended. Not defendable.** It can read process memory, log the master
password as it is typed, and screenshot decrypted content. **No desktop password
manager resists this**, including every commercial one, and any product claiming
otherwise is describing marketing rather than architecture.

What is done at the margins, and honestly labelled as margins: capture exclusion
stops naive screenshotting, clipboard sealing keeps passwords out of Clipboard
History and cloud sync, auto-lock shortens the window. None of it stops a
determined attacker already inside the process boundary.

**If the machine is compromised, Keyblade does not save the user.** It makes a
machine they no longer physically control worthless to whoever has it.

### A6 — Network attacker

**Not applicable, structurally.** The application opens no sockets. There is no
server, no sync, no telemetry, no update check.

This is enforced rather than intended: CSP sets `connect-src 'none'`, no Tauri
`http`, `shell` or `updater` plugin is enabled, `cargo-deny` fails the build if a
networking crate enters the graph even transitively, CI asserts the process opens
no sockets, and builds are reproducible so the shipped binary can be checked
against the source.

### A7 — Supply chain

Compromise of a dependency, of the build, or of the distributed binary.

**Partially defended.** `cargo-audit` and `cargo-deny` in CI, committed
lockfiles, a deliberately small dependency count, SBOM per release, reproducible
builds so anyone can verify the binary matches the tag.

**Residual:** a compromised upstream crate that has not yet been reported would
not be caught. This is an industry-wide unsolved problem and it is not solved
here. `TRADEMARKS.md` addresses the distribution end: a fork must not be able to
call itself Keyblade, so a malicious build cannot borrow this project's identity.

### A8 — Coercion

Someone compelling the user to open the vault.

**Out of scope, deliberately.** No duress password, no hidden volumes, no
plausible deniability. These features are extremely hard to build convincingly,
and one that is merely convincing-looking is worse than none: it invites people
to rely on it in exactly the situations where being wrong is most dangerous.

### A9 — Weak master password

**Partially defended, and it is the user's decision.** Argon2id at a 256 MiB
floor makes each guess expensive, but no KDF creates entropy that was never
there. Strength feedback at creation is planned for M1. The application will not
refuse a weak password outright: a vault the user cannot open is not a security
win.

## Defences and what each one actually buys

| Defence | Stops | Does not stop |
| --- | --- | --- |
| Argon2id, 256 MiB floor, calibrated | Fast offline guessing | A password in a wordlist |
| XChaCha20-Poly1305 everywhere | Reading and undetected modification at rest | Anything while unlocked |
| Random vault key, wrapped | Password change costing an archive rewrite | Nothing by itself; it is an operational property |
| STREAM with a final-block flag | Truncation, appending, reordering, splicing | Deletion of the whole file |
| Header authenticated as AAD | Editing chunk size, version or nonce prefix | Reading the three fields it contains |
| Encrypted metadata | Filenames and structure leaking | Blob count and approximate sizes |
| Random blob names | Confirming a known file is present | Estimating how much is stored |
| `WDA_EXCLUDEFROMCAPTURE` | Screenshots, recording, screen sharing | Malware reading process memory |
| Sealed clipboard | Clipboard History, cloud sync to other devices | A clipboard manager running as the user |
| Auto-lock and zeroing | Keys surviving in memory after lock | Anything during the unlocked window |
| No network, enforced in CI | Exfiltration by the application itself | Exfiltration by other software |
| `#![forbid(unsafe_code)]` in the core | Memory-safety bugs in cryptographic code | Logic errors |

## Known residual risks

Recorded rather than hidden.

1. **The unlocked window is indefensible.** The central limitation, restated
   because it is the one people most want not to be true.
2. **Cold boot and DMA attacks** against RAM are out of scope for a userland
   application.
3. **The database size and access pattern** leak activity over time. SQLCipher
   encrypts pages, not shape.
4. **Blob sizes bound plaintext lengths** unless padding is enabled.
5. **Not independently audited.** The largest unquantified risk in the project.
   A test suite demonstrates the properties its author thought to check, and
   cryptographic constructions fail on the properties nobody thought of.
6. **Windows Hello moves part of the trust to the OS.** Optional, revocable, and
   never a replacement for the master password. Someone who does not want that
   trust boundary should leave it off.

## Review

This document changes when the architecture changes, when a milestone adds a
capability, or when an audit says it is wrong. Every change to
`crates/keyblade-core/src/crypto/` should be checked against it before merge.

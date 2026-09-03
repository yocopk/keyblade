# Security

## Status: not independently audited

**Keyblade has not been reviewed by an independent security auditor.** No part of
the cryptography, the key handling or the Windows integration has been examined by
anyone outside the project.

This is stated first, and not buried, because it is the single most important
thing to know before trusting software with your secrets. Until an audit happens,
the honest position is: the design is documented, the tests are public, the build
is reproducible -- check it yourself, or have someone you trust check it.

## Threat model

Security claims are meaningless without saying what they exclude. What follows is
binding: a report about something in "Defended" is a bug; something in "Not
defended" is a documented limitation, not a vulnerability.

### Defended

| Scenario | How |
| --- | --- |
| Laptop or SSD stolen, lost, or sold without wiping | Everything at rest is encrypted under a key derived from the master password |
| Vault files copied to cloud, NAS, USB stick, or Windows Backup | Same -- the files are useless without the password |
| Another Windows account on the same machine | File encryption; no key material is shared through the OS |
| Brief physical access with the session locked | Auto-lock on session change, suspend and idle; keys are zeroised on lock |
| Forensic analysis of the disk | No plaintext temporaries, no plaintext cache, no key material in the page file |
| Screenshots and screen recording by other apps | `WDA_EXCLUDEFROMCAPTURE` on the window |
| Windows Clipboard History and cloud clipboard sync | Clipboard entries marked as excluded; auto-cleared after a timeout |
| Metadata leakage | Filenames, extensions, sizes, dates and folder structure are encrypted, not just contents |
| Tampering or truncation of encrypted files | AEAD over every chunk plus an explicit final-chunk marker; decryption fails, it does not silently degrade |

### Not defended

| Scenario | Why |
| --- | --- |
| Malware running as your user while the vault is **unlocked** | Keyloggers, infostealers and RATs see what you see. **No desktop password manager defends against this**, including commercial ones |
| Physical access while the vault is open on screen | Nothing software can do |
| Cold boot and DMA attacks against RAM | Out of scope for a userland application |
| Compromised firmware, drivers or operating system | The trust anchor is already gone |
| A weak master password | No KDF rescues `password123`. Argon2id raises the cost per guess; it does not create entropy that was never there |
| Coercion of the user | No plausible-deniability or duress features are offered, because doing them badly is worse than not doing them |

If your machine is compromised, Keyblade will not save you. It is built so that a
machine you no longer physically control is useless to whoever has it.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private reporting: *Security* tab -> *Report a vulnerability*. Include
what you found, how to reproduce it, and what an attacker gains. A proof of concept
helps but is not required.

Expect an acknowledgement within 7 days and an assessment within 30. If a fix is
warranted you will be credited in the release notes unless you prefer otherwise.
Please allow a fix to ship before publishing.

In scope: anything in this repository. Out of scope: the "Not defended" table above,
findings that require an already-compromised machine, and reports consisting solely
of automated scanner output.

## Cryptography

Summary; the normative version is `docs/CRYPTO-SPEC.md`.

- **Key derivation** -- Argon2id, calibrated at vault creation to roughly one
  second on the machine, floor of 256 MiB of memory. Parameters are stored in the
  vault header so a vault stays openable on slower hardware.
- **Encryption** -- XChaCha20-Poly1305. The 192-bit nonce can be generated randomly
  per message with no practical collision risk, which AES-GCM's 96-bit nonce cannot
  offer at the number of chunks a file vault produces.
- **Key hierarchy** -- the master password never encrypts data. It derives a key
  that unwraps a randomly generated vault key. Changing the master password
  rewrites 32 bytes, not the archive.
- **Large files** -- STREAM chunked AEAD, 1 MiB chunks, with the final chunk
  distinguished by a nonce flag so truncation is detected rather than tolerated.
- **No custom cryptography.** Every primitive comes from an established, audited
  crate. Where this project has latitude it uses it on *composition*, not on
  inventing primitives.

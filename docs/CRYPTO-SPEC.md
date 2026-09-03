# Cryptographic specification

Normative for everything under `src-tauri/src/crypto/`. The blob format has its
own document, [`FILE-FORMAT.md`](FILE-FORMAT.md).

## Primitives

| Purpose | Choice | Crate |
| --- | --- | --- |
| Password hashing | Argon2id, v1.3 (0x13) | `argon2` |
| Authenticated encryption | XChaCha20-Poly1305 | `chacha20poly1305` |
| Chunked AEAD | STREAM, `EncryptorBE32` / `DecryptorBE32` | `chacha20poly1305::aead::stream` |
| Subkey derivation | BLAKE3 `derive_key` | `blake3` |
| Randomness | OS CSPRNG | `rand_core::OsRng` |
| Constant-time comparison | `subtle::ConstantTimeEq` | `subtle` |
| Memory zeroing | `Zeroize`, `ZeroizeOnDrop` | `zeroize` |

**No primitive is implemented in this project.** Where it exercises judgement is
in composition, in domain separation, and in what it refuses to accept.

### Why XChaCha20-Poly1305 and not AES-GCM

The nonce. XChaCha's is 192 bits, so nonces can be generated randomly for every
message with no practical collision risk. AES-GCM's is 96 bits, where a repeat
under the same key is catastrophic and the birthday bound starts to matter at
around 2³² messages. A vault that chunks video at 1 MiB produces messages by the
million, and a design that requires careful nonce bookkeeping to stay safe is a
design that will eventually be wrong.

Secondarily: ChaCha is constant-time in pure software. AES without AES-NI is
either slow or timing-vulnerable, and whether AES-NI is present and enabled is
not something the application controls.

### Why BLAKE3 derive_key and not HKDF

`derive_key` is a KDF with domain separation built into its signature: the
context string is a required argument, not an optional `info` field that is easy
to leave empty. The context strings in `keyring.rs` are long, dated and unique,
which is what makes two subkeys of the same vault key unrelated.

## Key hierarchy

```
                       master password
                             │
                             │  Argon2id
                             │  salt: 16 random bytes, per vault
                             │  params: calibrated, stored in the vault header
                             ▼
                      MK ── MasterKey (32 B)
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   wrap(VK, MK)      wrap(VK, RK)          wrap(VK, HK)
   always present    optional, M4          optional, M4
        │            recovery kit          Windows Hello via DPAPI
        └────────────────────┼────────────────────┘
                             ▼
                      VK ── VaultKey (32 B, random, never derived)
                             │
              BLAKE3 derive_key with distinct contexts
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   DB_KEY              INDEX_KEY          wrap(CK, VK) per file
   SQLCipher           search index       CK random per blob
```

### The indirection is the design

The master password never encrypts data. It derives a key whose only job is to
unwrap the vault key, and the vault key is what everything descends from.

The reason is operational. Changing the master password re-wraps 32 bytes.
Enrolling Windows Hello adds one wrapped copy. Revoking a recovery kit deletes
one. A design that derived the data key straight from the password would make
each of those operations proportional to the size of the vault, which in practice
means users never change their password.

`keyring.rs::changing_the_master_password_preserves_the_vault_key` is the test
that holds this property in place.

### Domain separation

Every wrapped key is bound to its role by associated data:

| Wrapped key | Associated data |
| --- | --- |
| Vault key under a master key | `keyblade:vault-key:v1` |
| Content key under the vault key | `keyblade:content-key:v1` |

Every derived subkey is bound to its purpose by a BLAKE3 context string:

| Subkey | Context |
| --- | --- |
| Metadata database | `keyblade 2026-09-03 vault database key v1` |
| Search index | `keyblade 2026-09-03 search index key v1` |

Without this, a wrapped content key could be substituted where a wrapped vault
key is expected. `keyring.rs::wrapped_keys_cannot_be_swapped_between_roles`
asserts both directions fail.

These strings are part of the on-disk format. A new purpose gets a new constant;
an existing one is never edited, because editing it makes every existing vault
underivable.

## Argon2id parameters

| Parameter | Value |
| --- | --- |
| Algorithm | Argon2id |
| Version | 0x13 |
| Output | 32 bytes |
| Salt | 16 bytes, random per vault |
| Memory floor | 256 MiB, enforced by `KdfParams::validate` |
| Memory ceiling | 4 GiB, enforced on read |
| Default passes | 3 |
| Default parallelism | 4 |
| Parallelism ceiling | 64 |
| Calibration target | ~1000 ms on the creating machine |

### Calibrated, not hardcoded

`calibrate()` measures the machine at vault creation and picks the highest memory
cost that stays under the target, never below the floor. The chosen parameters
are stored in the vault header, so a vault created on a fast desktop still opens
on a slow laptop, only more slowly.

The floor matters more than the target: it is what a vault gets on the weakest
machine that ever creates one.

### The ceilings are denial-of-service guards, not security parameters

Parameters are read from a file that an attacker may have written. Without a
ceiling, a crafted header could ask the process to allocate 4 TiB before a single
byte has been authenticated. `KdfParams::from_bytes` validates before returning,
and the hostile-header cases are tested in `kdf.rs`.

The same reasoning applies to `chunk_size` in the blob header.

## Handling of key material

- Every key is a `Key32`, which is `ZeroizeOnDrop`.
- `Key32` has no `Display`, and its `Debug` prints `Key32(<redacted>)`. Tested,
  because a key reaching a log is a realistic failure and a silent one.
- `Key32` has no `PartialEq`. Comparison is `ct_eq`, so `==` cannot be used on a
  secret by accident.
- Intermediate plain arrays are explicitly zeroised after being moved into a
  `Key32`, since a bare `[u8; 32]` does not zeroise itself.
- The crate is `#![forbid(unsafe_code)]`.
- Release builds use `panic = "abort"`, so a panic cannot unwind through code
  holding key material.

Still outstanding, scheduled for M1 because they need the application process
rather than this library:

- `VirtualLock` on pages holding keys, to keep them out of the page file.
- Disabling Windows Error Reporting dumps, which would otherwise contain keys.
- Auto-lock zeroing on idle, session change and suspend.

## What is tested, and what that proves

55 tests, all in CI.

**Round-trip and boundary** — every size around the chunk boundary, from empty
to two chunks plus one byte. These prove the happy path works.

**Negative tests** — `tests/tampering.rs`, twenty cases. Truncation, appending,
reordering, duplication, cross-file splicing, bit flips in every structurally
distinct region, malformed headers, wrong keys. These prove the format *refuses*,
which is the part a broken construction fails.

**Wire format lock** — a committed test vector. It does not prove XChaCha20-Poly1305
is correct; RustCrypto tests that against the specification. It locks what this
project chose: header layout, field order, endianness, associated-data binding
and nonce prefix length. Any drift breaks every vault already written, and this
test is what stops it happening quietly.

**Error opacity** — a wrong key and a corrupt tag must produce the identical
error string. A caller that can distinguish them has an oracle for probing a
stolen vault.

**Fuzzing** — `cargo fuzz` targets on the header parser and the full decryption
path. Arbitrary bytes must produce `Ok` or `Err`, never a panic. With
`panic = "abort"`, a panic is a crash, and a crash can produce a dump.

### What none of this proves

That the composition is sound. Test suites demonstrate the properties their
author thought to check, and the properties an author does not think of are
exactly where cryptographic constructions fail. **This code has not been
independently audited.** Until it has, the tests, the specification and the
reproducible build are what allow someone else to check the work without having
to trust it.

# Blob file format, version 1

Normative. This document and `crates/keyblade-core/src/crypto/stream.rs` must agree; where
they disagree, the code is wrong until one of them changes deliberately.

The format is locked by a test vector in `stream.rs::tests::wire_format_is_stable`.
Any change that alters a byte fails that test, which is the intended behaviour:
the on-disk format cannot drift by accident, because a vault written by an older
build must stay readable by a newer one.

## Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│ HEADER            101 bytes, plaintext, authenticated as AAD          │
├───────────────────────────────────────────────────────────────────────┤
│ CHUNK 0           chunk_size bytes of ciphertext + 16-byte tag        │
│ CHUNK 1           chunk_size bytes of ciphertext + 16-byte tag        │
│ ...                                                                   │
│ CHUNK N           ≤ chunk_size bytes of ciphertext + 16-byte tag      │
│                   sealed with the final-block flag set                │
└───────────────────────────────────────────────────────────────────────┘
```

Total size for a plaintext of `L` bytes with `C = chunk_size`:

```
101 + L + 16 × ceil(L / C)        for L > 0
101 + 16                          for L = 0
```

An empty plaintext still produces one final chunk. Decrypting an empty file
yields an empty file rather than an error, and the file still carries a tag, so
an empty vault entry cannot be forged into a non-empty one.

## Header

Offsets are absolute, integers are little-endian.

| Offset | Length | Field | Notes |
| ---: | ---: | --- | --- |
| 0 | 4 | `magic` | ASCII `KBLD`. Rejected if different |
| 4 | 2 | `version` | u16, currently `1`. Rejected if different |
| 6 | 4 | `chunk_size` | u32, plaintext bytes per chunk. Must be within 4 KiB and 8 MiB |
| 10 | 19 | `nonce_prefix` | Random, from the OS CSPRNG, unique per file |
| 29 | 72 | `wrapped_content_key` | The file's content key, wrapped under the vault key |

Writers emit `chunk_size = 1 MiB`. Readers accept the documented range so that
the value can change in future without a format version bump, and so that tests
can use small chunks.

### wrapped_content_key

| Offset | Length | Field |
| ---: | ---: | --- |
| 0 | 24 | XChaCha20-Poly1305 nonce |
| 24 | 32 | Encrypted content key |
| 56 | 16 | Poly1305 tag |

Wrapped with associated data `keyblade:content-key:v1`. That binding is what
stops a wrapped content key from being presented where a vault key or a database
key is expected: the associated data would not match and unwrapping fails.

### The header is plaintext, and that is deliberate

A reader needs `chunk_size` and `nonce_prefix` before it holds any key, so they
cannot be encrypted. They are instead **authenticated**: the full 101-byte header
is passed as associated data to every chunk. Editing any field, including the
version or the chunk size, makes every chunk fail to open.

The header leaks the following, and nothing else: that the file is a Keyblade
blob, the format version, and the chunk size. It does not leak the original
filename, the file type, the creation date, or the exact plaintext length. Those
live in the encrypted index. The blob size does bound the plaintext length; see
the padding note in `ARCHITECTURE.md`.

## Chunks

Each chunk is XChaCha20-Poly1305 over at most `chunk_size` plaintext bytes,
producing that many ciphertext bytes followed by a 16-byte tag.

The nonce follows the STREAM construction, implemented by `aead::stream`'s
`EncryptorBE32` and `DecryptorBE32` rather than written by hand:

```
nonce (24 bytes) = nonce_prefix (19) ‖ counter (4, big-endian) ‖ last_flag (1)
```

- `counter` starts at 0 and increments per chunk.
- `last_flag` is `0x00` for every chunk except the last, which is `0x01`.

Associated data for every chunk is the full 101-byte header.

### Why the final-block flag is the whole point

Without `last_flag`, a chunked format looks correct and passes every round-trip
test while silently accepting truncated files: an attacker cuts the tail off,
every remaining chunk still authenticates, and the reader returns a shorter
document as though it were genuine. For a vault holding contracts or recovery
codes, silently losing the end of a file is a real attack, not a corruption case.

With the flag, the chunk that becomes last was sealed as "not last" but is opened
as "last", so its tag does not verify. `tests/tampering.rs::removing_the_final_chunk_is_detected`
is the test that a naive implementation fails.

The same mechanism rejects appended data: the genuine final chunk is opened as a
non-final chunk and fails.

## Random seeking

Chunk `n` begins at:

```
offset(n) = 101 + n × (chunk_size + 16)
```

So a video player seeking to an arbitrary timestamp reads one chunk and decrypts
it, instead of decrypting everything before the target. `chunk_offset()` in
`stream.rs` is this formula, and `chunk_offsets_match_the_layout` locks it.

A chunk decrypted out of order still authenticates, because its nonce depends
only on its own index. The trade-off is that seeking cannot verify the file *as a
whole* without reading all of it: a seek proves the chunk is genuine and in the
right position, not that the file is complete. Sequential reads get the full
guarantee, including truncation detection.

## Limits

| Quantity | Limit | Reason |
| --- | --- | --- |
| Chunks per file | 2³² − 1 | 32-bit STREAM counter |
| File size at 1 MiB chunks | ~4 PiB | Consequence of the above |
| `chunk_size` accepted | 4 KiB to 8 MiB | Below: overhead. Above: memory-exhaustion guard on untrusted input |

## What a reader must reject

Enforced by `Header::from_bytes` and `decrypt_stream`, each with a test in
`tests/tampering.rs`:

- A file shorter than 101 bytes
- Wrong magic, unsupported version, `chunk_size` outside the accepted range
- Any modified byte, in the header or in any chunk
- A missing final chunk, or a final chunk missing bytes
- Data appended after the final chunk
- Chunks reordered, duplicated, or spliced in from another file
- A wrong vault key

All of these produce the same opaque `decryption failed`, except the header
checks, which report a reason. Header parsing happens before any key is
involved, so its errors reveal nothing about secrets, and a corrupt file is worth
being able to diagnose.

## Compatibility policy

`version` is bumped only for a change that a version-1 reader cannot parse
correctly. Readers must reject versions they do not know rather than attempt a
best effort: for an encrypted format, guessing is worse than failing.

# Contributing

## Before anything else

**Security issues never go in a public issue.** Use the *Security* tab, then *Report
a vulnerability*. See [`SECURITY.md`](SECURITY.md).

Contributions require agreeing to the [CLA](CLA.md). A bot will prompt you on your
first pull request; it takes one click.

## Ground rules for a project like this one

This software guards other people's secrets, so a few things are stricter here than
they would be elsewhere.

**No new cryptographic primitives. Ever.** If a change needs a primitive that is not
already in use, it needs a discussion in an issue first, and the answer will usually
be an established crate. Composition is where this project exercises judgement;
primitives are not.

**Crypto changes need tests that fail before the fix.** A change to anything under
`crates/keyblade-core/src/crypto/` is not reviewable without test vectors and, where applicable,
negative tests proving that tampering is rejected.

**Key material stays in Rust.** Nothing from the key hierarchy may cross the IPC
boundary into the web layer. The frontend receives decrypted values for the item it
asked for, never a key.

**No network dependency.** `cargo-deny` will fail your build if you add one, and the
answer to "but it is only for X" is no.

**No `unsafe` without justification.** Where Windows APIs require it, keep the
`unsafe` block minimal and document the invariant it upholds in a comment directly
above it.

## Workflow

1. Open an issue first for anything beyond an obvious fix, so effort is not wasted.
2. Branch from `main`.
3. Make the change, with tests.
4. Run the gates below.
5. Open a pull request describing what changed and why.

## Gates

Everything here runs in CI, so run it locally first:

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo deny check
```

## Commits

Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`,
`perf:`, `ci:`. Write the body to explain *why*, not what. The diff already says what.

## Licensing of contributions

Every source file carries an SPDX header:

```rust
// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese
```

Keep it on files you add. Your contribution is licensed under AGPL-3.0-only under the
terms of the CLA, and you keep your copyright.

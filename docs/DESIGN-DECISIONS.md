# Design decisions

How the Claude Design mock became the interface in this repository, and every
place the result deliberately differs from it.

The mock is at `Keyblade.dc.html` in the handoff bundle. It is a prototype in
static HTML with inline styles and a `<sc-if>` templating layer, and none of its
markup, CSS or script is in this repository: it was read as a specification of
intent and rewritten in React with the project's tokens.

## Component inventory

The repository had **no frontend components** when this work started — only the
Rust crypto crate and an application shell. So the reuse-first rule had nothing
to reuse: every entry below is a Create, and the search that would normally
justify that is simply the absence of `src/components`.

What the mock draws as forty-odd bespoke inline-styled elements reduces to
thirteen components once the repetition is taken out.

| Component | Where the mock repeats it |
| --- | --- |
| `Icon` | 46 distinct glyphs, ~60 uses |
| `Button` | 4 variants × 4 sizes, 14 uses |
| `Sweep` | The band of light, on 3 different elements |
| `TextField` | Password, search, and 3 compose fields |
| `EyebrowLabel` | The mono uppercase caption, 12 uses |
| `Wordmark` | Lock screen and sidebar, 2 sizes |
| `StainedGlass` | 6 instances at 4 sizes |
| `ParticleField` | Both scenes |
| `Toggle`, `SegmentedControl` | Settings |
| `Callout` | 3 uses |
| `Modal` | The compose dialog |
| `HatchPanel` | Dropzone and viewer placeholder |

Scenes compose those: `LockScene` with `VaultSwitcher` and `DerivationProgress`;
`VaultScene` with `CommandMenu`, `VaultHud`, `Topbar`, `ItemList`, `DetailPanel`,
`SecretField`, `ComposeDialog` and `SettingsView`.

## Deliberate deviations

Everything in this table is a case where the project won over the mock. Each was
raised before implementation.

### The tertiary text colour fails WCAG AA

The mock uses `#5C6F92` for field captions, hints and metadata — 21 occurrences,
at 9.5px to 12px. Measured against the surfaces it sits on:

| Surface | Contrast | AA for small text |
| --- | ---: | --- |
| `--abyss` `#0E1628` | 3.56:1 | fails (needs 4.5:1) |
| `--sunken` `#0A1122` | 3.71:1 | fails |
| `--void` `#080B14` | 3.88:1 | fails |

Shipped as **`#7A8BAB`**, the lightest value in the same hue that clears 4.5:1 on
all three. The step down from `--muted` `#93A4C6` is smaller than the mock's, so
the three-level hierarchy is slightly compressed — worth it, because the failing
level was carrying every field label in the application.

The project's own earlier `--faint` (`#64769B`) failed the same test at 3.42:1
and was corrected at the same time.

### The icon font is not loaded

The mock pulls Material Symbols and four text faces from Google Fonts. This
application sets `connect-src 'none'` and makes no network requests at all, so a
CDN font is not available to it in any form.

The 46 glyphs are generated into `src/components/Icon/paths.ts` as inline SVG by
`scripts/build-icons.mjs`, from the Material Symbols sources (Apache-2.0) held as
a devDependency and never shipped. A subset font was the alternative; inline
paths win because they tree-shake, they are readable in a diff, and they add no
binary to a repository whose whole argument is that you can check what it does.

The four text faces are self-hosted in `src/assets/fonts`: Marcellus 400, Cinzel
Decorative 700, IBM Plex Sans 400/500/600 and IBM Plex Mono 400/500, latin subset
only, 128 kB of woff2 in total. `scripts/build-fonts.mjs` extracts them from the
`@fontsource` packages, writes `src/styles/fonts.css`, and copies each licence
alongside the files as the OFL requires. Only the weights the interface actually
sets are shipped.

Arrows (↑↓) fall outside the latin subset and render from the system fallback.
That is correct rather than a gap: they are symbols, not text in these faces.

### The layout assumed a fixed 1180px

The mock sets `min-width: 1180px` on the dashboard. A desktop window is
resizable and gets put beside other windows, so:

- **≥ 1180px** — sidebar, list, detail, as designed.
- **1024–1180px** — the detail panel stacks under the list in normal flow, and
  the body becomes the single scrolling region.
- The Tauri window minimum is **1024×620**, so the sidebar — which carries all
  navigation and the lock button — is never hidden.

### The interface is translated

The mock is entirely in Italian while the repository, its documentation and its
code are in English. Italian is the default and English is complete; the
dictionaries are typed against each other, so a missing key is a build error
rather than a blank label. `<html lang>` follows the active locale, without which
a screen reader reads Italian copy with English phonetics.

### Additions the mock could not show

A static prototype has no reason to include these, and a real interface is
unusable without them:

- **Modal focus management** — focus enters the dialog on open, lands on the
  first input rather than the close button, is trapped while open, and returns
  to the opener on close.
- **Roles that match behaviour** — the command menu is a `tablist`, the item list
  a `listbox`, the lock intervals a `radiogroup`, the settings switches
  `role="switch"`. The mock draws all of them as plain buttons.
- **Accessible names** on every icon-only control.
- **Safe centring** on the lock screen. Plain centring clips the top of the
  stained glass on a short window.

### Corrections to the earlier specification

Two numbers in `docs/CRYPTO-SPEC.md` were wrong and the mock inherited one:

- A wrapped key is **72 bytes**, not 48: the earlier figure forgot the 24-byte
  nonce. The blob header is therefore 101 bytes.
- The mock's derivation panel says `m=512 MiB`. The implementation calibrates at
  vault creation with a 256 MiB floor, so the real figure depends on the machine.

## What is not implemented

The interface runs on sample data from `src/data/sampleVault.ts`. There is no
vault behind it: unlocking is a timer of roughly the length Argon2id actually
takes, copying starts a countdown without touching the clipboard, and added items
live in memory until reload.

The seams are in place — `locked`, `deriving`, the item source, the reveal set —
so M1 replaces the data source and leaves the components alone.

The sample content is in Italian regardless of the active locale, because it
stands in for what a user typed rather than for interface copy. It is labelled as
sample data in the list header.

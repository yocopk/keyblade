// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

/**
 * Sample content, so the interface can be seen working before a vault exists.
 *
 * None of this is real and none of it is stored: it lives in memory for the
 * length of a session and disappears on reload. M1 replaces this module with
 * the SQLCipher index; the components consume the types in `./types` and will
 * not notice the change.
 *
 * The values are deliberately implausible as credentials — no real service, no
 * real IBAN, no real document number — so that nothing here can be mistaken for
 * something worth harvesting.
 */

import type { IconName } from "../components/Icon/Icon";
import type { CategoryId, ItemsByCategory, VaultSummary } from "./types";

export const SAMPLE_VAULTS: readonly VaultSummary[] = [
  { salt: "3f9a2c1e", fileName: "andrea.kbld" },
  { salt: "a17e0433", fileName: "lavoro.kbld" },
  { salt: "08c5be71", fileName: "famiglia.kbld" },
];

/** Icon for each tag, used as the small marker on the right of a row. */
export const TAG_ICONS: Readonly<Record<string, IconName>> = {
  finanze: "payments",
  identità: "badge",
  infra: "dns",
  rete: "router",
  documenti: "description",
  casa: "cottage",
  salute: "medical_services",
  auto: "directions_car",
  backup: "cloud_off",
  critico: "priority_high",
  nuovo: "label",
};

export const CATEGORY_ICONS: Readonly<Record<CategoryId | "settings", IconName>> = {
  passwords: "password",
  documents: "description",
  images: "photo_library",
  videos: "movie",
  notes: "sticky_note_2",
  settings: "tune",
};

export const SAMPLE_ITEMS: ItemsByCategory = {
  passwords: [
    {
      id: "pw-bank",
      name: "Banca · conto corrente",
      subtitle: "area clienti · secondo fattore su app",
      tag: "finanze",
      badge: "2FA",
      icon: "account_balance",
      isFile: false,
      fields: [
        { label: "UTENTE", value: "AM-40718", secret: false },
        { label: "PASSWORD", value: "Vh7#qL2!mR9_tsK", secret: true },
        { label: "DOMINIO", value: "area-clienti.local", secret: false },
        { label: "TOTP", value: "419 802", secret: true },
      ],
    },
    {
      id: "pw-mail",
      name: "Posta principale",
      subtitle: "identità · usata per i recuperi",
      tag: "identità",
      badge: "—",
      icon: "alternate_email",
      isFile: false,
      fields: [
        { label: "UTENTE", value: "andrea@—", secret: false },
        { label: "PASSWORD", value: "pQ4v-Rz8s-Wm1t-Xe6", secret: true },
        { label: "DOMANDA", value: "via del primo appartamento", secret: true },
      ],
    },
    {
      id: "pw-ssh",
      name: "SSH · server di casa",
      subtitle: "chiave privata ed25519 + passphrase",
      tag: "infra",
      badge: "ed25519",
      icon: "terminal",
      isFile: false,
      fields: [
        { label: "HOST", value: "192.168.1.24:22", secret: false },
        { label: "PASSPHRASE", value: "ck6-Lm2-vT9-qZ4-hB8", secret: true },
        { label: "FINGERPRINT", value: "SHA256:9c1f…a70e", secret: false },
      ],
    },
    {
      id: "pw-router",
      name: "Router di casa",
      subtitle: "pannello di amministrazione",
      tag: "rete",
      badge: "—",
      icon: "wifi",
      isFile: false,
      fields: [
        { label: "UTENTE", value: "admin", secret: false },
        { label: "PASSWORD", value: "Tz3%wKp9$Ln2", secret: true },
        { label: "WPA2", value: "casa-8842-lungo", secret: true },
      ],
    },
    {
      id: "pw-tax",
      name: "Archivio fiscale",
      subtitle: "credenziali dello sportello telematico",
      tag: "documenti",
      badge: "PIN",
      icon: "gavel",
      isFile: false,
      fields: [
        { label: "CODICE", value: "MRCNDR91…", secret: false },
        { label: "PIN", value: "48 291 077", secret: true },
        { label: "PASSWORD", value: "Xq8!rNv3_Ph6#dW", secret: true },
      ],
    },
  ],
  documents: [
    {
      id: "doc-lease",
      name: "Contratto di affitto 2026.pdf",
      subtitle: "aggiunto il 14/02/26 · 3 pagine",
      tag: "casa",
      badge: "2,4 MB",
      icon: "picture_as_pdf",
      isFile: true,
      viewerIcon: "picture_as_pdf",
      fields: [
        { label: "NOME ORIGINALE", value: "contratto-affitto-2026.pdf", secret: false },
        { label: "TIPO", value: "application/pdf", secret: false },
        { label: "DIMENSIONE", value: "2 411 093 B · 3 chunk", secret: false },
        { label: "NOTE", value: "scadenza 31/01/2030", secret: false },
      ],
    },
    {
      id: "doc-passport",
      name: "Passaporto · scansione.pdf",
      subtitle: "documento di identità",
      tag: "identità",
      badge: "1,1 MB",
      icon: "picture_as_pdf",
      isFile: true,
      viewerIcon: "picture_as_pdf",
      fields: [
        { label: "NOME ORIGINALE", value: "passaporto-scan.pdf", secret: false },
        { label: "TIPO", value: "application/pdf", secret: false },
        { label: "DIMENSIONE", value: "1 148 220 B · 2 chunk", secret: false },
        { label: "NUMERO", value: "YA 4180932", secret: true },
      ],
    },
    {
      id: "doc-medical",
      name: "Referto medico.pdf",
      subtitle: "aggiunto il 02/09/26",
      tag: "salute",
      badge: "860 kB",
      icon: "picture_as_pdf",
      isFile: true,
      viewerIcon: "picture_as_pdf",
      fields: [
        { label: "NOME ORIGINALE", value: "referto-2026-09.pdf", secret: false },
        { label: "TIPO", value: "application/pdf", secret: false },
        { label: "DIMENSIONE", value: "880 640 B · 1 chunk", secret: false },
      ],
    },
  ],
  images: [
    {
      id: "img-id-front",
      name: "Carta d'identità · fronte.png",
      subtitle: "2480 × 1748 · scansione 300 dpi",
      tag: "identità",
      badge: "4,0 MB",
      icon: "image",
      isFile: true,
      viewerIcon: "image",
      fields: [
        { label: "NOME ORIGINALE", value: "ci-fronte.png", secret: false },
        { label: "TIPO", value: "image/png", secret: false },
        { label: "DIMENSIONE", value: "4 194 304 B · 4 chunk", secret: false },
      ],
    },
    {
      id: "img-transfer",
      name: "Ricevuta bonifico.jpg",
      subtitle: "1170 × 2532 · foto da telefono",
      tag: "finanze",
      badge: "620 kB",
      icon: "image",
      isFile: true,
      viewerIcon: "image",
      fields: [
        { label: "NOME ORIGINALE", value: "IMG_2841.jpg", secret: false },
        { label: "TIPO", value: "image/jpeg", secret: false },
        { label: "DIMENSIONE", value: "634 880 B · 1 chunk", secret: false },
      ],
    },
    {
      id: "img-car",
      name: "Targa e telaio auto.jpg",
      subtitle: "4032 × 3024",
      tag: "auto",
      badge: "3,1 MB",
      icon: "image",
      isFile: true,
      viewerIcon: "image",
      fields: [
        { label: "NOME ORIGINALE", value: "auto-telaio.jpg", secret: false },
        { label: "TIPO", value: "image/jpeg", secret: false },
        { label: "TELAIO", value: "ZFA3120000…", secret: true },
      ],
    },
  ],
  videos: [
    {
      id: "vid-handover",
      name: "Consegna appartamento.mp4",
      subtitle: "11:42 · stato dei locali alla firma",
      tag: "casa",
      badge: "1,8 GB",
      icon: "movie",
      isFile: true,
      viewerIcon: "play_circle",
      fields: [
        { label: "NOME ORIGINALE", value: "consegna-appartamento.mp4", secret: false },
        { label: "TIPO", value: "video/mp4", secret: false },
        { label: "DIMENSIONE", value: "1 932 735 283 B · 1 843 chunk", secret: false },
        { label: "SEEK", value: "header + n × (1 MiB + 16 B)", secret: false },
      ],
    },
    {
      id: "vid-phone",
      name: "Backup telefono · marzo.mp4",
      subtitle: "48:03 · registrazione schermo",
      tag: "backup",
      badge: "6,2 GB",
      icon: "movie",
      isFile: true,
      viewerIcon: "play_circle",
      fields: [
        { label: "NOME ORIGINALE", value: "screen-marzo.mp4", secret: false },
        { label: "TIPO", value: "video/mp4", secret: false },
        { label: "DIMENSIONE", value: "6 657 199 308 B · 6 349 chunk", secret: false },
      ],
    },
  ],
  notes: [
    {
      id: "note-recovery",
      name: "Kit di recupero · 24 parole",
      subtitle: "generato il 03/09/26 · mai esportato",
      tag: "critico",
      badge: "RK",
      icon: "key_vertical",
      isFile: false,
      fields: [
        {
          label: "PAROLE 1–8",
          value: "ancora · brace · cedro · dune · ferro · gelso · indaco · lastra",
          secret: true,
        },
        {
          label: "PAROLE 9–16",
          value: "muschio · nodo · ombra · pietra · quarzo · rame · sasso · tiglio",
          secret: true,
        },
        {
          label: "PAROLE 17–24",
          value: "urna · vetro · zolla · argilla · bosco · cardo · duna · erica",
          secret: true,
        },
      ],
    },
    {
      id: "note-bank",
      name: "Coordinate bancarie",
      subtitle: "IBAN e intestatari",
      tag: "finanze",
      badge: "—",
      icon: "sticky_note_2",
      isFile: false,
      fields: [
        { label: "IBAN", value: "IT00 X000 0000 0000 0000 0000 000", secret: true },
        { label: "BIC", value: "—", secret: false },
        { label: "INTESTATARIO", value: "A. Marchese", secret: false },
      ],
    },
    {
      id: "note-family",
      name: "Istruzioni per i familiari",
      subtitle: "cosa fare del vault · 1 200 caratteri",
      tag: "critico",
      badge: "nota",
      icon: "sticky_note_2",
      isFile: false,
      fields: [
        {
          label: "CONTENUTO",
          value: "Il kit di recupero è in cassaforte, busta sigillata…",
          secret: true,
        },
      ],
    },
  ],
};

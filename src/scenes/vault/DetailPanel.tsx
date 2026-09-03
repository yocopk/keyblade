// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { EyebrowLabel } from "../../components/EyebrowLabel/EyebrowLabel";
import { HatchPanel } from "../../components/HatchPanel/HatchPanel";
import { Icon } from "../../components/Icon/Icon";
import { StainedGlass } from "../../components/StainedGlass/StainedGlass";
import type { VaultItem } from "../../data/types";
import { useTranslation } from "../../i18n";
import { seedOf } from "../../lib/seed";
import { SecretField } from "./SecretField";
import styles from "./DetailPanel.module.css";

interface DetailPanelProps {
  item: VaultItem | undefined;
  vaultSalt: string;
  category: string;
  revealed: ReadonlySet<string>;
  onToggleReveal: (key: string) => void;
  copiedKey: string | null;
  copiedSeconds: number;
  onCopy: (key: string) => void;
}

/**
 * Everything about the selected item.
 *
 * The blob path shown at the bottom is derived, not stored: it is what the
 * folder would look like for this entry. The point it makes is that the name on
 * disk says nothing about the contents, which is why blobs are named by random
 * UUID rather than by a hash of what they hold.
 */
export function DetailPanel({
  item,
  vaultSalt,
  category,
  revealed,
  onToggleReveal,
  copiedKey,
  copiedSeconds,
  onCopy,
}: DetailPanelProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.panel}>
      <StainedGlass salt={vaultSalt} size={420} className={styles.watermark} />

      {item !== undefined && (
        <div className={styles.content}>
          <div className={styles.heading}>
            <EyebrowLabel icon={item.isFile ? "lock" : "list_alt"} tone="gold">
              {item.isFile ? t.detail.kindBlob : t.detail.kindIndex}
            </EyebrowLabel>
            <div className={styles.name} data-selectable>
              {item.name}
            </div>
            <div className={styles.subtitle}>{item.subtitle}</div>
          </div>

          {item.isFile && (
            <HatchPanel
              border="solid"
              surface="var(--abyss)"
              borderColor="var(--edge-cool)"
              className={styles.viewer}
            >
              <div className={styles.viewerInner}>
                <Icon name={item.viewerIcon ?? "visibility"} size={30} color="var(--gold)" />
                <div className={styles.viewerCaption}>
                  {t.detail.viewer}
                  <br />
                  <span style={{ color: "var(--faint)" }}>
                    {item.badge} · {t.detail.viewerNote}
                  </span>
                </div>
              </div>
            </HatchPanel>
          )}

          <div className={styles.fields}>
            {item.fields.map((field, index) => {
              const key = `${category}/${item.id}/${index}`;
              return (
                <SecretField
                  key={key}
                  label={field.label}
                  value={field.value}
                  secret={field.secret}
                  revealed={revealed.has(key)}
                  onToggleReveal={() => onToggleReveal(key)}
                  onCopy={() => onCopy(key)}
                  copiedSeconds={copiedKey === key ? copiedSeconds : null}
                />
              );
            })}
          </div>

          <div className={styles.blob}>
            <EyebrowLabel icon="database">{t.detail.blob}</EyebrowLabel>
            <div className={styles.blobPath} data-selectable>
              {blobPath(item, category)}
            </div>
            <div className={styles.blobCipher}>{t.detail.cipher}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A plausible on-disk path for this entry, for illustration only. */
function blobPath(item: VaultItem, category: string): string {
  const shard = seedOf(item.name).toString(16).slice(0, 2);
  const name = seedOf(item.name + category).toString(16);
  const suffix = seedOf(item.subtitle).toString(16);
  return `blobs\\${shard}\\${name}-${suffix}.kb`;
}

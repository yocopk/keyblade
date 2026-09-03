// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { Icon } from "../../components/Icon/Icon";
import { StainedGlass } from "../../components/StainedGlass/StainedGlass";
import type { VaultSummary } from "../../data/types";
import styles from "./VaultSwitcher.module.css";

interface VaultSwitcherProps {
  vaults: readonly VaultSummary[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/**
 * Picks which vault to open, by its window rather than by its name.
 *
 * Each vault is drawn from its own salt, so the three sigils are always
 * distinguishable and always the same. Recognising your vault by its glass is
 * faster than reading a filename, and harder to spoof.
 */
export function VaultSwitcher({ vaults, selectedIndex, onSelect }: VaultSwitcherProps) {
  return (
    <div className={styles.sigils} role="radiogroup" aria-label="Vault">
      {vaults.map((vault, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={vault.salt}
            type="button"
            role="radio"
            aria-checked={selected}
            title={vault.fileName}
            className={`${styles.option} ${selected ? styles.selected : ""}`}
            onClick={() => onSelect(index)}
          >
            {selected && (
              <span aria-hidden className={styles.cursor}>
                <Icon name="arrow_drop_down" size={13} />
              </span>
            )}
            <StainedGlass salt={vault.salt} size={60} className={styles.sigil} />
            <span className={styles.label}>
              {vault.salt.slice(0, 4)}·{vault.salt.slice(4)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

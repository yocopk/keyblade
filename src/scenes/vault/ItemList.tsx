// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { Icon } from "../../components/Icon/Icon";
import { TAG_ICONS } from "../../data/sampleVault";
import type { VaultItem } from "../../data/types";
import { useTranslation } from "../../i18n";
import styles from "./ItemList.module.css";

interface ItemListProps {
  items: readonly VaultItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  label: string;
}

/**
 * The rows of the current category.
 *
 * A listbox rather than a stack of buttons, because exactly one row is selected
 * at a time and the arrow keys move that selection. Marking it up correctly is
 * what makes the keyboard navigation in `App` audible as well as visible.
 */
export function ItemList({ items, selectedIndex, onSelect, label }: ItemListProps) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <Icon name="search_off" size={19} />
        <span>{t.list.empty}</span>
      </div>
    );
  }

  return (
    <div className={styles.list} role="listbox" aria-label={label} tabIndex={-1}>
      {items.map((item, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={selected}
            className={styles.row}
            onClick={() => onSelect(index)}
          >
            {selected && (
              <>
                <span aria-hidden className={styles.selectedFrame} />
                <span aria-hidden className={styles.selectedBar} />
              </>
            )}
            <Icon name={item.icon} size={20} color="var(--muted)" />
            <span className={styles.text}>
              <span className={styles.name}>{item.name}</span>
              <span className={styles.subtitle}>{item.subtitle}</span>
            </span>
            <Icon
              name={TAG_ICONS[item.tag] ?? "label"}
              size={17}
              color="var(--faint)"
              label={item.tag}
            />
            <span className={styles.badge}>{item.badge}</span>
          </button>
        );
      })}
    </div>
  );
}

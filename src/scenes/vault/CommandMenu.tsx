// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { Icon, type IconName } from "../../components/Icon/Icon";
import { Sweep } from "../../components/Button/Sweep";
import styles from "./CommandMenu.module.css";

export interface CommandMenuEntry<T extends string> {
  id: T;
  label: string;
  icon: IconName;
  /** Item count. Omitted for entries that are not lists, such as settings. */
  count?: number;
}

interface CommandMenuProps<T extends string> {
  entries: ReadonlyArray<CommandMenuEntry<T>>;
  selected: T;
  onSelect: (id: T) => void;
  label: string;
}

/**
 * The vault's primary navigation.
 *
 * Shaped as a command menu — boxes with a gold cursor that follows the
 * selection — because that is what the design asked for, and because it happens
 * to be the right shape for the job: this is a keyboard-first application, and a
 * menu that shows its cursor is one a keyboard user can actually follow.
 *
 * Marked up as a tab list rather than a row of buttons, since selecting an entry
 * swaps the panel beside it rather than navigating away.
 */
export function CommandMenu<T extends string>({
  entries,
  selected,
  onSelect,
  label,
}: CommandMenuProps<T>) {
  return (
    <div className={styles.menu} role="tablist" aria-label={label} aria-orientation="vertical">
      {entries.map((entry) => {
        const active = entry.id === selected;
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={entry.label}
            className={styles.entry}
            onClick={() => onSelect(entry.id)}
          >
            {active && (
              <>
                <span aria-hidden className={styles.selectedFrame} />
                <Sweep width="40%" strength={0.14} duration="5.2s" />
              </>
            )}
            <span aria-hidden data-anim={active ? "bob" : undefined} className={styles.cursorSlot}>
              {active && <Icon name="play_arrow" size={14} className={styles.cursor} />}
            </span>
            <Icon name={entry.icon} size={19} color="var(--ice)" className={styles.icon} />
            <span className={styles.label}>{entry.label}</span>
            {entry.count !== undefined && <span className={styles.count}>{entry.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

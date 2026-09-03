// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import styles from "./SegmentedControl.module.css";

export interface Segment<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string | number> {
  segments: ReadonlyArray<Segment<T>>;
  value: T;
  onChange: (next: T) => void;
  /** Names the group as a whole for assistive technology. */
  label: string;
}

/**
 * A row of mutually exclusive choices, used for the auto-lock interval.
 *
 * `role="radiogroup"` rather than a row of buttons: the options are exclusive,
 * and saying so is what lets a screen reader announce "3 of 4" instead of
 * reading four unrelated buttons.
 */
export function SegmentedControl<T extends string | number>({
  segments,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={label}>
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <button
            key={String(segment.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`${styles.segment} ${selected ? styles.selected : ""}`}
            onClick={() => onChange(segment.value)}
          >
            <span className={styles.label}>{segment.label}</span>
          </button>
        );
      })}
    </div>
  );
}

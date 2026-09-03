// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import styles from "./Toggle.module.css";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** The accessible name. Required: a bare switch says nothing on its own. */
  label: string;
  id?: string;
}

/**
 * A two-state switch.
 *
 * Rendered as a real `role="switch"` with `aria-checked` rather than a styled
 * div, so it announces its state and responds to space and enter without any
 * key handling written here.
 */
export function Toggle({ checked, onChange, label, id }: ToggleProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={styles.toggle}
      onClick={() => onChange(!checked)}
    >
      {checked && <span className={styles.track} />}
      <span className={`${styles.knob} ${checked ? styles.on : styles.off}`} />
    </button>
  );
}

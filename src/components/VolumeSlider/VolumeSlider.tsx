// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { Icon, type IconName } from "../Icon/Icon";
import styles from "./VolumeSlider.module.css";

interface VolumeSliderProps {
  /** 0 to 1. */
  value: number;
  onChange: (next: number) => void;
  label: string;
  icon: IconName;
  disabled?: boolean;
}

/**
 * A volume control.
 *
 * A native range input rather than a custom track: it already handles arrow
 * keys, Home and End, page up and down, and announces its value, and none of
 * that is worth rewriting to change how a thumb looks.
 */
export function VolumeSlider({ value, onChange, label, icon, disabled }: VolumeSliderProps) {
  const percent = Math.round(value * 100);

  return (
    <div className={styles.row}>
      <Icon name={icon} size={16} color={disabled === true ? "var(--faint)" : "var(--gold)"} />
      <input
        type="range"
        className={styles.slider}
        min={0}
        max={100}
        step={5}
        value={percent}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={`${percent}%`}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
      <span className={styles.value}>{percent}%</span>
    </div>
  );
}

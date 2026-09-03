// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { Icon } from "../Icon/Icon";
import { useTranslation } from "../../i18n";
import styles from "./MusicControl.module.css";

interface MusicControlProps {
  /** Whether the music is switched on at all. */
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  /** 0 to 1. */
  volume: number;
  onVolumeChange: (next: number) => void;
}

/**
 * The music volume, reachable from anywhere.
 *
 * Pinned to the bottom right of both scenes rather than living only in
 * settings: background music is the one thing a person wants to turn down
 * *while* it is playing, and making them open a panel to do it is the reason
 * people mute applications at the operating system instead.
 *
 * The button alone is what is always visible; the slider widens out of it on
 * hover or focus. It is never removed from the DOM, so tabbing to it works and
 * reveals it in the process.
 */
export function MusicControl({
  enabled,
  onEnabledChange,
  volume,
  onVolumeChange,
}: MusicControlProps) {
  const { t } = useTranslation();
  const percent = Math.round(volume * 100);
  const silent = !enabled || percent === 0;

  return (
    <div className={styles.dock}>
      <div className={styles.reveal}>
        <input
          type="range"
          className={styles.slider}
          min={0}
          max={100}
          step={5}
          value={percent}
          disabled={!enabled}
          aria-label={t.sound.musicVolume}
          aria-valuetext={`${percent}%`}
          onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
        />
      </div>

      <span className={styles.value} aria-hidden>
        {silent ? "--" : `${percent}%`}
      </span>

      <button
        type="button"
        className={`${styles.toggle} ${silent ? styles.muted : ""}`}
        aria-pressed={enabled}
        title={enabled ? t.sound.mute : t.sound.unmute}
        aria-label={enabled ? t.sound.mute : t.sound.unmute}
        onClick={() => onEnabledChange(!enabled)}
      >
        <Icon name={silent ? "volume_off" : "volume_up"} size={19} />
      </button>
    </div>
  );
}

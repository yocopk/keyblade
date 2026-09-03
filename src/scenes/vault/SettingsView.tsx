// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { useId } from "react";

import { Callout } from "../../components/Callout/Callout";
import { EyebrowLabel } from "../../components/EyebrowLabel/EyebrowLabel";
import { Icon, type IconName } from "../../components/Icon/Icon";
import { SegmentedControl } from "../../components/SegmentedControl/SegmentedControl";
import { Toggle } from "../../components/Toggle/Toggle";
import { VolumeSlider } from "../../components/VolumeSlider/VolumeSlider";
import type { SoundSettings } from "../../hooks/useAudio";
import { useTranslation } from "../../i18n";
import styles from "./SettingsView.module.css";

/** Auto-lock choices, in seconds. Zero means never. */
export const LOCK_OPTIONS = [60, 300, 900, 0] as const;

export interface VisualSettings {
  particles: boolean;
  animations: boolean;
  halo: boolean;
  maskSecrets: boolean;
}

interface SettingsViewProps {
  settings: VisualSettings;
  onChange: (next: VisualSettings) => void;
  sound: SoundSettings;
  onSoundChange: (next: SoundSettings) => void;
  lockSeconds: number;
  onLockSecondsChange: (next: number) => void;
}

/**
 * Local preferences.
 *
 * Everything here is presentation except the last switch, which decides whether
 * secrets start masked. Saying so in the panel matters: a user must never be
 * left wondering whether a visual setting weakened their encryption.
 */
export function SettingsView({
  settings,
  onChange,
  sound,
  onSoundChange,
  lockSeconds,
  onLockSecondsChange,
}: SettingsViewProps) {
  const { t, format } = useTranslation();
  const groupId = useId();

  const rows: ReadonlyArray<{
    key: keyof VisualSettings;
    icon: IconName;
    label: string;
    description: string;
  }> = [
    { key: "particles", icon: "grain", label: t.settings.particles, description: t.settings.particlesDesc },
    { key: "animations", icon: "animation", label: t.settings.animations, description: t.settings.animationsDesc },
    { key: "halo", icon: "blur_on", label: t.settings.halo, description: t.settings.haloDesc },
    {
      key: "maskSecrets",
      icon: "visibility_off",
      label: t.settings.maskSecrets,
      description: t.settings.maskSecretsDesc,
    },
  ];

  return (
    <div className={styles.settings}>
      <div className={styles.group}>
        {rows.map((row) => {
          const id = `${groupId}-${row.key}`;
          return (
            <div key={row.key} className={styles.toggleRow}>
              <Icon name={row.icon} size={20} color="var(--gold)" />
              <label className={styles.toggleText} htmlFor={id}>
                <span className={styles.toggleLabel}>{row.label}</span>
                <span className={styles.toggleDesc}>{row.description}</span>
              </label>
              <Toggle
                id={id}
                label={row.label}
                checked={settings[row.key]}
                onChange={(next) => onChange({ ...settings, [row.key]: next })}
              />
            </div>
          );
        })}
      </div>

      <div className={styles.lockGroup}>
        <EyebrowLabel icon="volume_up">{t.sound.section}</EyebrowLabel>

        <div className={styles.group}>
          <div className={styles.toggleRow}>
            <Icon name="graphic_eq" size={20} color="var(--gold)" />
            <label className={styles.toggleText} htmlFor={`${groupId}-effects`}>
              <span className={styles.toggleLabel}>{t.sound.effects}</span>
              <span className={styles.toggleDesc}>{t.sound.effectsDesc}</span>
            </label>
            <Toggle
              id={`${groupId}-effects`}
              label={t.sound.effects}
              checked={sound.effects}
              onChange={(next) => onSoundChange({ ...sound, effects: next })}
            />
          </div>

          <div className={styles.sliderRow}>
            <VolumeSlider
              icon="graphic_eq"
              label={t.sound.effectsVolume}
              value={sound.effectsVolume}
              disabled={!sound.effects}
              onChange={(next) => onSoundChange({ ...sound, effectsVolume: next })}
            />
          </div>

          <div className={styles.toggleRow}>
            <Icon name="music_note" size={20} color="var(--gold)" />
            <label className={styles.toggleText} htmlFor={`${groupId}-music`}>
              <span className={styles.toggleLabel}>{t.sound.music}</span>
              <span className={styles.toggleDesc}>{t.sound.musicDesc}</span>
            </label>
            <Toggle
              id={`${groupId}-music`}
              label={t.sound.music}
              checked={sound.music}
              onChange={(next) => onSoundChange({ ...sound, music: next })}
            />
          </div>

          <div className={styles.sliderRow}>
            <VolumeSlider
              icon="music_note"
              label={t.sound.musicVolume}
              value={sound.musicVolume}
              disabled={!sound.music}
              onChange={(next) => onSoundChange({ ...sound, musicVolume: next })}
            />
          </div>
        </div>
      </div>

      <div className={styles.lockGroup}>
        <EyebrowLabel icon="timer">{t.settings.autoLock}</EyebrowLabel>
        <SegmentedControl
          label={t.settings.autoLock}
          value={lockSeconds}
          onChange={onLockSecondsChange}
          segments={LOCK_OPTIONS.map((seconds) => ({
            value: seconds,
            label:
              seconds === 0
                ? t.settings.never
                : seconds < 60
                  ? format(t.settings.seconds, { n: seconds })
                  : format(t.settings.minutes, { n: seconds / 60 }),
          }))}
        />
      </div>

      <Callout icon="info">
        {t.settings.note} <span className={styles.code}>{t.settings.noteCode}</span>{" "}
        {t.settings.noteTail}
      </Callout>
    </div>
  );
}

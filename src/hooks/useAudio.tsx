// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { createContext, useContext, useEffect, useMemo, useRef } from "react";

import {
  AudioEngine,
  DEFAULT_EFFECTS_VOLUME,
  DEFAULT_MUSIC_VOLUME,
  type EffectName,
} from "../lib/audio";

export interface SoundSettings {
  /** Interface sound effects. */
  effects: boolean;
  /** The looping background track. */
  music: boolean;
  /** 0 to 1. */
  effectsVolume: number;
  /** 0 to 1. Sits well below the effects by default. */
  musicVolume: number;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  effects: true,
  music: true,
  effectsVolume: DEFAULT_EFFECTS_VOLUME,
  musicVolume: DEFAULT_MUSIC_VOLUME,
};

interface AudioApi {
  /** Plays an effect, if effects are switched on. */
  play: (name: EffectName) => void;
  /** Starts the music, if music is switched on. Safe to call repeatedly. */
  startMusic: () => void;
  /** Pauses the music without rewinding. */
  pauseMusic: () => void;
}

const AudioContext = createContext<AudioApi>({
  play: () => {},
  startMusic: () => {},
  pauseMusic: () => {},
});

interface AudioProviderProps {
  settings: SoundSettings;
  children: React.ReactNode;
}

/**
 * Owns the audio engine for the lifetime of the application.
 *
 * The engine lives in a ref rather than in state: a sound is a side effect with
 * its own lifetime, and re-rendering a component must never restart one.
 *
 * Settings are read through a ref too, so changing the volume does not tear down
 * and rebuild the engine — which for a fifty-minute stream would mean starting
 * the track again from the beginning every time the slider moves.
 */
export function AudioProvider({ settings, children }: AudioProviderProps) {
  const engineRef = useRef<AudioEngine | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  /**
   * Returns a usable engine, building one if there is not one already.
   *
   * The "or disposed" half is load-bearing. StrictMode mounts, unmounts and
   * mounts again, so the cleanup below runs on the first pass and disposes the
   * engine — but the ref survives, and a disposed engine has an empty effects
   * map and plays nothing. Recreating on demand makes the double invocation
   * harmless, and covers any later unmount and remount for the same reason.
   */
  const engine = (): AudioEngine => {
    if (engineRef.current === null || engineRef.current.isDisposed()) {
      engineRef.current = new AudioEngine();
      engineRef.current.setEffectsVolume(settingsRef.current.effectsVolume);
      engineRef.current.setMusicVolume(settingsRef.current.musicVolume);
    }
    return engineRef.current;
  };

  useEffect(() => {
    return () => engineRef.current?.dispose();
  }, []);

  useEffect(() => {
    engineRef.current?.setEffectsVolume(settings.effectsVolume);
    engineRef.current?.setMusicVolume(settings.musicVolume);
  }, [settings.effectsVolume, settings.musicVolume]);

  useEffect(() => {
    if (!settings.music) engineRef.current?.stopMusic();
  }, [settings.music]);

  const api = useMemo<AudioApi>(
    () => ({
      play: (name) => {
        if (settingsRef.current.effects) engine().play(name);
      },
      startMusic: () => {
        if (settingsRef.current.music) void engine().startMusic();
      },
      pauseMusic: () => engineRef.current?.pauseMusic(),
    }),
    [],
  );

  return <AudioContext.Provider value={api}>{children}</AudioContext.Provider>;
}

/** Plays interface sounds. */
export function useAudio(): AudioApi {
  return useContext(AudioContext);
}

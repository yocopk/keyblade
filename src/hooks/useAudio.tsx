// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { createContext, useContext, useEffect, useMemo, useRef } from "react";

import {
  DEFAULT_EFFECTS_VOLUME,
  DEFAULT_MUSIC_VOLUME,
  getEngine,
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
 * Connects the settings to the audio engine.
 *
 * The engine itself lives in the module, not here. This component only reflects
 * settings into it and hands the rest of the tree a stable API — deliberately
 * so, because tying an engine's lifetime to a component's is what produced an
 * orphaned, uncontrollable audio element the last time round. See `lib/audio`.
 *
 * Settings are read through a ref inside the callbacks, so changing the volume
 * does not rebuild the API object and re-render every consumer.
 */
export function AudioProvider({ settings, children }: AudioProviderProps) {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Decode the effects once, as early as there is a document to do it in.
  useEffect(() => {
    getEngine().init();
  }, []);

  useEffect(() => {
    getEngine().setEffectsVolume(settings.effectsVolume);
  }, [settings.effectsVolume]);

  useEffect(() => {
    getEngine().setMusicVolume(settings.musicVolume);
  }, [settings.musicVolume]);

  useEffect(() => {
    if (settings.music) void getEngine().startMusic();
    else getEngine().stopMusic();
  }, [settings.music]);

  const api = useMemo<AudioApi>(
    () => ({
      play: (name) => {
        if (settingsRef.current.effects) getEngine().play(name);
      },
      startMusic: () => {
        if (settingsRef.current.music) void getEngine().startMusic();
      },
      pauseMusic: () => getEngine().pauseMusic(),
    }),
    [],
  );

  return <AudioContext.Provider value={api}>{children}</AudioContext.Provider>;
}

/** Plays interface sounds. */
export function useAudio(): AudioApi {
  return useContext(AudioContext);
}

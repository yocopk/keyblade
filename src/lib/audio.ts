// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

/**
 * Sound effects and background music.
 *
 * Two delivery routes, for two very different kinds of file:
 *
 * The effects are a few hundred kilobytes in total and have to fire the instant
 * something is pressed, so they ship inside the frontend bundle and are
 * preloaded into `Audio` elements at startup.
 *
 * The music is a fifty-minute file. It is **not** bundled: it sits beside the
 * installed application as a Tauri resource and is streamed from there, which
 * keeps it out of the binary and lets it be replaced without rebuilding.
 *
 * # Autoplay
 *
 * Browsers, and the WebView, refuse to play audio until the user has interacted
 * with the page. That is not a problem to work around here, it is the design:
 * the first sound is the one that plays when the vault is unlocked, and the
 * click that unlocks it is the gesture that grants permission. Music starts
 * after that, never before.
 *
 * Every playback call is best-effort. A missing file, a codec the system does
 * not have, a policy refusal — none of them are worth an error in a vault, so
 * they are swallowed and the interface carries on silently.
 */

/** The short interface sounds. Bundled. */
export const EFFECTS = {
  /** The vault opening. Plays once, on unlock. */
  start: "kh-start",
  /** Moving between items or menu entries. */
  navigation: "kh-navigation",
  /** A committing action: saving, copying, revealing. */
  confirm: "kh-confirm",
  /** Backing out: closing a dialog, locking. */
  back: "kh-back",
  /** A dialog appearing. */
  popup: "kh-popup",
} as const;

export type EffectName = keyof typeof EFFECTS;

/** Default levels. Music sits well under the effects: it is a room, not an event. */
export const DEFAULT_EFFECTS_VOLUME = 0.55;
// 0.20 rather than 0.18: the slider steps in fives, so a value between steps
// displays as one number while the audio plays at another.
export const DEFAULT_MUSIC_VOLUME = 0.2;

/** Where the streamed music lives, relative to the installed application. */
const MUSIC_RESOURCE = "music/kh-chill-playlist.mp3";

/** True when running inside Tauri rather than a plain browser. */
function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Resolves the music file to a URL the audio element can stream.
 *
 * Under Tauri the file is a bundled resource reached through the asset
 * protocol. In a browser — which is how the interface is developed and tested —
 * it comes from the dev server, which serves the same directory. Both stream;
 * neither loads fifty minutes of audio into memory.
 */
export async function resolveMusicUrl(): Promise<string> {
  if (!inTauri()) return "/music/kh-chill-playlist.mp3";

  const [{ resolveResource }, { convertFileSrc }] = await Promise.all([
    import("@tauri-apps/api/path"),
    import("@tauri-apps/api/core"),
  ]);
  return convertFileSrc(await resolveResource(MUSIC_RESOURCE));
}

/**
 * Holds the preloaded effects and the music element.
 *
 * Deliberately a plain object rather than React state: audio is a side effect
 * with its own lifetime, and re-rendering a component should never restart a
 * sound.
 */
export class AudioEngine {
  private readonly effects = new Map<EffectName, HTMLAudioElement>();
  private music: HTMLAudioElement | null = null;
  private effectsVolume = DEFAULT_EFFECTS_VOLUME;
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  private disposed = false;

  constructor() {
    for (const [name, file] of Object.entries(EFFECTS) as [EffectName, string][]) {
      const element = new Audio(`/audio/${file}.mp3`);
      element.preload = "auto";
      element.volume = this.effectsVolume;
      this.effects.set(name, element);
    }
  }

  /**
   * Plays an effect, cutting off any previous instance of the same one.
   *
   * Rewinding rather than layering matters when the arrow keys are held down:
   * without it, twenty overlapping copies of the navigation blip arrive at once.
   */
  play(name: EffectName): void {
    const element = this.effects.get(name);
    if (element === undefined) return;

    element.currentTime = 0;
    element.volume = this.effectsVolume;
    void element.play().catch(() => {
      // Autoplay policy, missing codec, missing file. None of them matter here.
    });
  }

  setEffectsVolume(volume: number): void {
    this.effectsVolume = clamp(volume);
    for (const element of this.effects.values()) element.volume = this.effectsVolume;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = clamp(volume);
    if (this.music !== null) this.music.volume = this.musicVolume;
  }

  /** Starts the background music, looping. Safe to call when already playing. */
  async startMusic(): Promise<void> {
    if (this.music !== null && !this.music.paused) return;

    if (this.music === null) {
      const element = new Audio(await resolveMusicUrl());
      element.loop = true;
      // "metadata" rather than "auto": the browser then streams on demand
      // instead of trying to buffer sixty-eight megabytes up front.
      element.preload = "metadata";
      element.volume = this.musicVolume;
      this.music = element;
    }

    try {
      await this.music.play();
    } catch {
      // Not yet allowed to make noise. It will be, after the next gesture.
    }
  }

  /** Stops the music and releases the stream. */
  stopMusic(): void {
    if (this.music === null) return;
    this.music.pause();
    this.music.currentTime = 0;
  }

  /** Pauses without rewinding, for when the vault locks. */
  pauseMusic(): void {
    this.music?.pause();
  }

  /** True once {@link dispose} has run. A disposed engine plays nothing. */
  isDisposed(): boolean {
    return this.disposed;
  }

  dispose(): void {
    this.stopMusic();
    this.music = null;
    for (const element of this.effects.values()) {
      element.pause();
      element.src = "";
    }
    this.effects.clear();
    this.disposed = true;
  }
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

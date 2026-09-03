// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

/**
 * Sound effects and background music.
 *
 * # One engine, owned by the module
 *
 * The engine is a module-level singleton, not React state and not a ref.
 *
 * It was a ref, and that was a bug. StrictMode mounts, unmounts and mounts
 * again; the unmount disposed the engine, and because `startMusic` awaits before
 * it touches anything, a disposal landing inside that await left an audio
 * element playing that no live engine referenced. The music kept going while the
 * volume control moved a different object — which is exactly what "the slider
 * does nothing" looks like from the outside.
 *
 * Audio is a global side effect with its own lifetime. Owning it at module level
 * removes the whole class of problem rather than guarding each instance of it.
 *
 * # Two mechanisms, for two jobs
 *
 * **Effects** go through the Web Audio API. They are decoded once into buffers
 * at startup and played through a gain node, which starts them on the same tick
 * they are asked for. `HTMLAudioElement.play()` returns a promise and schedules
 * playback, and on a button press that reads as lag.
 *
 * **Music** stays an `HTMLAudioElement`, because it is a fifty-minute file and
 * Web Audio would have to decode the whole thing into memory before the first
 * note. An element streams it.
 *
 * # Autoplay
 *
 * The music plays from the moment the lock screen appears. In the packaged
 * application it simply does: the WebView is launched with
 * `--autoplay-policy=no-user-gesture-required`, which is reasonable for a
 * program the user started deliberately, unlike a page that opened itself.
 *
 * In a browser the first attempt is refused, so a one-shot listener starts
 * playback on the first pointer or key event rather than leaving it silent.
 */

/** The short interface sounds. Bundled with the frontend. */
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
// would display as one number while the audio played at another.
export const DEFAULT_MUSIC_VOLUME = 0.2;

/** Where the streamed music lives, relative to the installed application. */
const MUSIC_RESOURCE = "music/kh-chill-playlist.mp3";

/** True when running inside Tauri rather than a plain browser. */
function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Resolves the music file to a URL that can be streamed.
 *
 * Under Tauri it is a bundled resource reached through the asset protocol. In a
 * browser it comes from the dev server, which serves the same directory. Both
 * stream; neither loads fifty minutes of audio into memory.
 */
async function resolveMusicUrl(): Promise<string> {
  if (!inTauri()) return "/music/kh-chill-playlist.mp3";

  const [{ resolveResource }, { convertFileSrc }] = await Promise.all([
    import("@tauri-apps/api/path"),
    import("@tauri-apps/api/core"),
  ]);
  return convertFileSrc(await resolveResource(MUSIC_RESOURCE));
}

class Engine {
  private context: AudioContext | null = null;
  private effectsGain: GainNode | null = null;
  private readonly buffers = new Map<EffectName, AudioBuffer>();

  private music: HTMLAudioElement | null = null;
  private musicWanted = false;

  private effectsVolume = DEFAULT_EFFECTS_VOLUME;
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  private gestureArmed = false;

  /** Decodes every effect once. Idempotent; safe to call from an effect body. */
  init(): void {
    if (this.context !== null) return;

    const withWebkit = window as unknown as { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? withWebkit.webkitAudioContext;
    if (Ctor === undefined) return;

    this.context = new Ctor();
    this.effectsGain = this.context.createGain();
    this.effectsGain.gain.value = this.effectsVolume;
    this.effectsGain.connect(this.context.destination);

    for (const [name, file] of Object.entries(EFFECTS) as [EffectName, string][]) {
      void this.load(name, `/audio/${file}.mp3`);
    }
  }

  private async load(name: EffectName, url: string): Promise<void> {
    try {
      const response = await fetch(url);
      const bytes = await response.arrayBuffer();
      const context = this.context;
      if (context === null) return;
      this.buffers.set(name, await context.decodeAudioData(bytes));
    } catch {
      // A missing or undecodable effect is not worth an error in a vault. The
      // interface simply stays quiet for that one.
    }
  }

  /**
   * Plays an effect immediately.
   *
   * A fresh source node per call: nodes are single-use, and it lets two effects
   * overlap rather than one cutting the other off.
   */
  play(name: EffectName): void {
    const context = this.context;
    const gain = this.effectsGain;
    const buffer = this.buffers.get(name);
    if (context === null || gain === null || buffer === undefined) return;

    // A context created before any gesture starts suspended. Resuming is cheap
    // and a no-op once it is already running.
    if (context.state === "suspended") void context.resume().catch(() => {});

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start();
  }

  setEffectsVolume(volume: number): void {
    this.effectsVolume = clamp(volume);
    if (this.effectsGain !== null) this.effectsGain.gain.value = this.effectsVolume;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = clamp(volume);
    if (this.music !== null) this.music.volume = this.musicVolume;
  }

  /** Starts the music, looping. Safe to call repeatedly. */
  async startMusic(): Promise<void> {
    this.musicWanted = true;

    if (this.music === null) {
      const url = await resolveMusicUrl();
      // The wish may have been withdrawn while the URL was resolving.
      if (!this.musicWanted) return;

      const element = new Audio(url);
      element.loop = true;
      // "metadata" rather than "auto": the browser streams on demand instead of
      // trying to buffer sixty-eight megabytes up front.
      element.preload = "metadata";
      element.volume = this.musicVolume;
      this.music = element;
    }

    if (!this.music.paused) return;

    try {
      await this.music.play();
    } catch {
      this.startOnFirstGesture();
    }
  }

  /** Stops the music and rewinds. */
  stopMusic(): void {
    this.musicWanted = false;
    if (this.music === null) return;
    this.music.pause();
    this.music.currentTime = 0;
  }

  /**
   * Pauses without rewinding.
   *
   * No caller yet: the music deliberately keeps playing when the vault locks,
   * because it starts on the lock screen and belongs to the application rather
   * than to the unlocked session.
   *
   * It stays because M1 needs it. When the Windows session locks or the machine
   * suspends the user has walked away, and a vault that keeps playing to an
   * empty room is a bug. That hook cannot be written until the application
   * process can subscribe to those events.
   */
  pauseMusic(): void {
    this.musicWanted = false;
    this.music?.pause();
  }

  /**
   * Retries playback the next time the user touches anything.
   *
   * Only one listener is ever armed, and it removes itself, so a refused start
   * cannot accumulate handlers on the window.
   */
  private startOnFirstGesture(): void {
    if (this.gestureArmed) return;
    this.gestureArmed = true;

    const attempt = () => {
      window.removeEventListener("pointerdown", attempt);
      window.removeEventListener("keydown", attempt);
      this.gestureArmed = false;
      if (this.context?.state === "suspended") void this.context.resume().catch(() => {});
      if (this.musicWanted) void this.startMusic();
    };

    window.addEventListener("pointerdown", attempt, { once: true });
    window.addEventListener("keydown", attempt, { once: true });
  }
}

export type { Engine };

let engine: Engine | null = null;

/**
 * The one audio engine.
 *
 * Created on first use and never torn down: a React component's lifetime is the
 * wrong lifetime for a sound.
 */
export function getEngine(): Engine {
  engine ??= new Engine();
  return engine;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

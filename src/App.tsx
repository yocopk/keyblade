// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { useCallback, useEffect, useMemo, useState } from "react";

import type { IconName } from "./components/Icon/Icon";
import { MusicControl } from "./components/MusicControl/MusicControl";
import { CATEGORY_ICONS, SAMPLE_ITEMS, SAMPLE_VAULTS } from "./data/sampleVault";
import { CATEGORY_IDS, FILE_CATEGORIES, type CategoryId, type VaultItem } from "./data/types";
import {
  AudioProvider,
  DEFAULT_SOUND_SETTINGS,
  useAudio,
  type SoundSettings,
} from "./hooks/useAudio";
import { useAutoLock } from "./hooks/useAutoLock";
import { useCopyTimer } from "./hooks/useCopyTimer";
import { DEFAULT_LOCALE, LocaleContext, useTranslation, type Locale } from "./i18n";
import { generatePassword } from "./lib/password";
import { DERIVATION_MS, LockScene } from "./scenes/lock/LockScene";
import { ComposeDialog, type ComposeField } from "./scenes/vault/ComposeDialog";
import { SettingsView, type VisualSettings } from "./scenes/vault/SettingsView";
import { VaultScene } from "./scenes/vault/VaultScene";
import "./styles/global.css";

const SETTINGS_PANEL = "settings";
type PanelId = CategoryId | typeof SETTINGS_PANEL;

interface Draft {
  name: string;
  first: string;
  second: string;
}

const EMPTY_DRAFT: Draft = { name: "", first: "", second: "" };

export function App() {
  const [locale] = useState<Locale>(DEFAULT_LOCALE);
  const [sound, setSound] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS);

  // Keep the document language in step with the interface. Without this a
  // screen reader pronounces Italian copy with English phonetics, which is the
  // kind of defect that is invisible on screen and disqualifying in use.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LocaleContext.Provider value={locale}>
      <AudioProvider settings={sound}>
        <Keyblade sound={sound} onSoundChange={setSound} />
        {/*
          Outside both scenes on purpose: the music plays from the lock screen
          onwards, so the way to turn it down has to survive locking too.
        */}
        <MusicControl
          enabled={sound.music}
          onEnabledChange={(next) => setSound((previous) => ({ ...previous, music: next }))}
          volume={sound.musicVolume}
          onVolumeChange={(next) => setSound((previous) => ({ ...previous, musicVolume: next }))}
        />
      </AudioProvider>
    </LocaleContext.Provider>
  );
}

interface KeybladeProps {
  sound: SoundSettings;
  onSoundChange: (next: SoundSettings) => void;
}

/**
 * Application state.
 *
 * Everything here is presentation state over sample data: there is no vault
 * behind it yet, and nothing is persisted. What the shape is doing is holding
 * the seams M1 needs — `locked`, `deriving`, the item source, the reveal set —
 * so that wiring the real vault in replaces the data and leaves the components
 * untouched.
 */
function Keyblade({ sound, onSoundChange }: KeybladeProps) {
  const { t, format } = useTranslation();
  const audio = useAudio();

  const [locked, setLocked] = useState(true);
  const [deriving, setDeriving] = useState(false);
  const [vaultIndex, setVaultIndex] = useState(0);
  const [panel, setPanel] = useState<PanelId>("passwords");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [added, setAdded] = useState<Partial<Record<CategoryId, readonly VaultItem[]>>>({});
  const [lockSeconds, setLockSeconds] = useState(300);
  const [settings, setSettings] = useState<VisualSettings>({
    particles: true,
    animations: true,
    halo: true,
    maskSecrets: true,
  });

  const copyTimer = useCopyTimer();
  const vault = SAMPLE_VAULTS[vaultIndex];

  const showingSettings = panel === SETTINGS_PANEL;
  const category = showingSettings ? null : (panel as CategoryId);

  const lock = useCallback(() => {
    setLocked(true);
    setDeriving(false);
    setRevealed(new Set());
    setComposing(false);
    copyTimer.reset();
    audio.play("back");
  }, [copyTimer, audio]);

  const { remaining, touch } = useAutoLock(lockSeconds, lock, !locked);

  /** Every item in a category: what the user added this session, then the samples. */
  const itemsIn = useCallback(
    (id: CategoryId): readonly VaultItem[] => [...(added[id] ?? []), ...SAMPLE_ITEMS[id]],
    [added],
  );

  const visibleItems = useMemo(() => {
    if (category === null) return [];
    const all = itemsIn(category);
    const needle = query.trim().toLowerCase();
    if (needle === "") return all;
    return all.filter((item) =>
      `${item.name} ${item.subtitle} ${item.tag}`.toLowerCase().includes(needle),
    );
  }, [category, itemsIn, query]);

  // Keep the selection inside the list when filtering shortens it.
  const safeIndex = Math.min(selectedIndex, Math.max(0, visibleItems.length - 1));

  // Escape locks, or closes the dialog first. Arrows move the selection.
  useEffect(() => {
    if (locked) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (composing) {
          setComposing(false);
          audio.play("back");
        } else {
          lock();
        }
        return;
      }
      if (composing || showingSettings) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (visibleItems.length === 0) return;

      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setSelectedIndex((previous) => {
        const next = (previous + step + visibleItems.length) % visibleItems.length;
        return next;
      });
      audio.play("navigation");
      touch();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, composing, showingSettings, visibleItems.length, lock, touch, audio]);

  const unlock = useCallback(() => {
    setDeriving(true);
    // The click that got here is also the gesture that lets the page make
    // noise at all, so this is the earliest any sound can play.
    audio.play("start");

    // Stands in for Argon2id. M1 replaces it with the real derivation, which
    // takes about this long by design.
    window.setTimeout(() => {
      setDeriving(false);
      setLocked(false);
      touch();
    }, DERIVATION_MS);
  }, [touch, audio]);

  const toggleReveal = useCallback(
    (key: string) => {
      setRevealed((previous) => {
        const next = new Set(previous);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      audio.play("confirm");
      touch();
    },
    [touch, audio],
  );

  const saveDraft = useCallback(() => {
    if (category === null || draft.name.trim() === "") return;
    const stamp = new Date().toLocaleDateString();
    const isFile = FILE_CATEGORIES.has(category);

    const item: VaultItem = {
      id: `new-${Date.now()}`,
      name: draft.name.trim(),
      subtitle: stamp,
      tag: "nuovo",
      badge: isFile ? "—" : "nuovo",
      icon: CATEGORY_ICONS[category],
      isFile,
      viewerIcon: isFile ? CATEGORY_ICONS[category] : undefined,
      fields: isFile
        ? [{ label: t.compose.fieldVaultName, value: draft.name.trim(), secret: false }]
        : [
            { label: t.compose.fieldUser, value: draft.first || "—", secret: false },
            { label: t.compose.fieldPassword, value: draft.second || "—", secret: true },
          ],
    };

    setAdded((previous) => ({ ...previous, [category]: [item, ...(previous[category] ?? [])] }));
    setComposing(false);
    setDraft(EMPTY_DRAFT);
    setSelectedIndex(0);
    setQuery("");
    audio.play("confirm");
    touch();
  }, [category, draft, t, touch, audio]);

  if (locked) {
    return (
      <LockScene
        vaults={SAMPLE_VAULTS}
        selectedVault={vaultIndex}
        onSelectVault={setVaultIndex}
        onUnlock={unlock}
        deriving={deriving}
        particles={settings.particles}
        animations={settings.animations}
        halo={settings.halo}
      />
    );
  }

  const menu = [
    ...CATEGORY_IDS.map((id) => ({
      id: id as PanelId,
      label: t.categories[categoryKey(id)],
      icon: CATEGORY_ICONS[id],
      count: itemsIn(id).length,
    })),
    {
      id: SETTINGS_PANEL as PanelId,
      label: t.categories.settings,
      icon: CATEGORY_ICONS.settings,
    },
  ];

  const composeFields: ComposeField[] =
    category === null
      ? []
      : FILE_CATEGORIES.has(category)
        ? [
            {
              key: "name",
              label: t.compose.fieldVaultName,
              icon: "label",
              hint: t.compose.hintVaultName,
              value: draft.name,
            },
            {
              key: "first",
              label: t.compose.fieldNote,
              icon: "notes",
              hint: t.compose.hintNote,
              value: draft.first,
            },
          ]
        : category === "notes"
          ? [
              {
                key: "name",
                label: t.compose.fieldTitle,
                icon: "label",
                hint: t.compose.hintTitle,
                value: draft.name,
              },
              {
                key: "first",
                label: t.compose.fieldContent,
                icon: "sticky_note_2",
                hint: t.compose.hintContent,
                value: draft.first,
              },
            ]
          : [
              {
                key: "name",
                label: t.compose.fieldName,
                icon: "label",
                hint: t.compose.hintName,
                value: draft.name,
              },
              {
                key: "first",
                label: t.compose.fieldUser,
                icon: "person",
                hint: t.compose.hintUser,
                value: draft.first,
              },
              {
                key: "second",
                label: t.compose.fieldPassword,
                icon: "password",
                hint: t.compose.hintPassword,
                value: draft.second,
                generate: () => {
                  setDraft((previous) => ({ ...previous, second: generatePassword() }));
                  touch();
                },
              },
            ];

  return (
    <VaultScene
      vault={vault}
      menu={menu}
      panel={panel}
      onPanelChange={(next) => {
        setPanel(next as PanelId);
        setSelectedIndex(0);
        setComposing(false);
        audio.play("navigation");
        touch();
      }}
      categoryLabel={showingSettings ? t.categories.settings : t.categories[categoryKey(category!)]}
      categoryIcon={(showingSettings ? CATEGORY_ICONS.settings : CATEGORY_ICONS[category!]) as IconName}
      meta={
        showingSettings
          ? t.list.settingsMeta
          : format(t.list.meta, { shown: visibleItems.length, total: itemsIn(category!).length })
      }
      items={visibleItems}
      totalItems={category === null ? 0 : itemsIn(category).length}
      selectedIndex={safeIndex}
      onSelectItem={(index) => {
        setSelectedIndex(index);
        audio.play("navigation");
        touch();
      }}
      query={query}
      onQueryChange={(next) => {
        setQuery(next);
        setSelectedIndex(0);
      }}
      onAdd={
        showingSettings
          ? undefined
          : () => {
              setDraft(EMPTY_DRAFT);
              setComposing(true);
              audio.play("popup");
              touch();
            }
      }
      onOpenSettings={() => {
        setPanel(SETTINGS_PANEL);
        setComposing(false);
        touch();
      }}
      revealed={settings.maskSecrets ? revealed : ALL_REVEALED}
      onToggleReveal={toggleReveal}
      copiedKey={copyTimer.copiedKey}
      copiedSeconds={copyTimer.secondsLeft}
      onCopy={(key) => {
        copyTimer.copy(key);
        audio.play("confirm");
        touch();
      }}
      remaining={lockSeconds === 0 ? null : remaining}
      onLock={lock}
      particles={settings.particles}
      animations={settings.animations}
      settingsPanel={
        showingSettings ? (
          <SettingsView
            settings={settings}
            onChange={(next) => {
              setSettings(next);
              touch();
            }}
            sound={sound}
            onSoundChange={(next) => {
              onSoundChange(next);
              touch();
            }}
            lockSeconds={lockSeconds}
            onLockSecondsChange={(next) => {
              setLockSeconds(next);
              touch();
            }}
          />
        ) : undefined
      }
      dialog={
        composing && category !== null ? (
          <ComposeDialog
            title={composeTitle(category, t)}
            icon={FILE_CATEGORIES.has(category) ? "upload_file" : CATEGORY_ICONS[category]}
            isFile={FILE_CATEGORIES.has(category)}
            note={composeNote(category, t)}
            fields={composeFields}
            onFieldChange={(key, value) => {
              setDraft((previous) => ({ ...previous, [key]: value }));
              touch();
            }}
            onPickFile={() =>
              setDraft((previous) => ({
                ...previous,
                name: previous.name === "" ? t.compose.hintVaultName : previous.name,
              }))
            }
            onCancel={() => {
              setComposing(false);
              audio.play("back");
            }}
            onSave={saveDraft}
            canSave={draft.name.trim() !== ""}
          />
        ) : undefined
      }
    />
  );
}

/**
 * A set that claims to contain everything, for when "hide secrets by default" is
 * off. Cheaper and clearer than building a set of every field key on each render.
 */
const ALL_REVEALED: ReadonlySet<string> = {
  has: () => true,
  size: Number.POSITIVE_INFINITY,
} as unknown as ReadonlySet<string>;

type Translations = ReturnType<typeof useTranslation>["t"];

/** Maps a category id onto its key in the dictionary. */
function categoryKey(id: CategoryId): keyof Translations["categories"] {
  return id;
}

function composeTitle(category: CategoryId, t: Translations): string {
  switch (category) {
    case "passwords":
      return t.compose.titlePassword;
    case "notes":
      return t.compose.titleNote;
    case "images":
      return t.compose.titleImage;
    case "videos":
      return t.compose.titleVideo;
    case "documents":
      return t.compose.titleDocument;
  }
}

function composeNote(category: CategoryId, t: Translations): string {
  if (category === "passwords") return t.compose.notePassword;
  if (category === "notes") return t.compose.noteNote;
  return t.compose.noteFile;
}

export type { Locale };

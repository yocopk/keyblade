// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { EyebrowLabel } from "../../components/EyebrowLabel/EyebrowLabel";
import { Icon, type IconName } from "../../components/Icon/Icon";
import { ParticleField } from "../../components/ParticleField/ParticleField";
import { StainedGlass } from "../../components/StainedGlass/StainedGlass";
import { Wordmark } from "../../components/Wordmark/Wordmark";
import type { VaultItem, VaultSummary } from "../../data/types";
import { useTranslation } from "../../i18n";
import { CommandMenu, type CommandMenuEntry } from "./CommandMenu";
import { DetailPanel } from "./DetailPanel";
import { ItemList } from "./ItemList";
import { Topbar } from "./Topbar";
import { VaultHud } from "./VaultHud";
import styles from "./VaultScene.module.css";

/** Panels the command menu can select: a content category, or settings. */
export type PanelId = string;

interface VaultSceneProps {
  vault: VaultSummary;
  menu: ReadonlyArray<CommandMenuEntry<PanelId>>;
  panel: PanelId;
  onPanelChange: (id: PanelId) => void;

  categoryLabel: string;
  categoryIcon: IconName;
  meta: string;

  /** Items for the current category, already filtered by the search box. */
  items: readonly VaultItem[];
  totalItems: number;
  selectedIndex: number;
  onSelectItem: (index: number) => void;

  query: string;
  onQueryChange: (next: string) => void;
  onAdd?: () => void;
  onOpenSettings: () => void;

  revealed: ReadonlySet<string>;
  onToggleReveal: (key: string) => void;
  copiedKey: string | null;
  copiedSeconds: number;
  onCopy: (key: string) => void;

  remaining: number | null;
  onLock: () => void;

  particles: boolean;
  animations: boolean;

  /** Rendered instead of the list when the settings panel is selected. */
  settingsPanel?: React.ReactNode;
  dialog?: React.ReactNode;
}

/** The unlocked vault: sidebar, topbar, list and detail. */
export function VaultScene(props: VaultSceneProps) {
  const { t } = useTranslation();
  const showingSettings = props.settingsPanel !== undefined;
  const selectedItem = props.items[props.selectedIndex];

  return (
    <div className={styles.scene}>
      <ParticleField
        enabled={props.particles}
        animated={props.animations}
        count={26}
        intensity={0.55}
      />

      <aside className={styles.sidebar}>
        <div className={styles.identity}>
          <StainedGlass salt={props.vault.salt} size={34} label={props.vault.fileName} />
          <div className={styles.identityText}>
            <Wordmark size="small" />
            <div className={styles.vaultFile}>{props.vault.fileName}</div>
          </div>
        </div>

        <CommandMenu
          entries={props.menu}
          selected={props.panel}
          onSelect={props.onPanelChange}
          label={t.topbar.settings}
        />

        <div className={styles.spacer} />

        <VaultHud remaining={props.remaining} onLock={props.onLock} />
      </aside>

      <div className={styles.main}>
        <Topbar
          query={props.query}
          onQueryChange={props.onQueryChange}
          onAdd={props.onAdd}
          onOpenSettings={props.onOpenSettings}
        />

        <div className={styles.body}>
          <div className={styles.list}>
            <div className={styles.listHead}>
              <div className={styles.category}>
                <Icon name={props.categoryIcon} size={22} color="var(--gold)" />
                <span className={styles.categoryName}>{props.categoryLabel}</span>
              </div>
              <div className={styles.meta}>{props.meta}</div>
            </div>

            {!showingSettings && (
              <div className={styles.demoBanner}>
                <Icon name="info" size={13} />
                <span>{t.demo.banner}</span>
              </div>
            )}

            {showingSettings ? (
              props.settingsPanel
            ) : (
              <ItemList
                items={props.items}
                selectedIndex={props.selectedIndex}
                onSelect={props.onSelectItem}
                label={props.categoryLabel}
              />
            )}
          </div>

          {!showingSettings && (
            <DetailPanel
              item={selectedItem}
              vaultSalt={props.vault.salt}
              category={props.panel}
              revealed={props.revealed}
              onToggleReveal={props.onToggleReveal}
              copiedKey={props.copiedKey}
              copiedSeconds={props.copiedSeconds}
              onCopy={props.onCopy}
            />
          )}
        </div>
      </div>

      {props.dialog}
    </div>
  );
}

/** Re-exported so App can build the menu without reaching into the scene. */
export type { CommandMenuEntry };
export { EyebrowLabel };

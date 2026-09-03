// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { Button } from "../../components/Button/Button";
import { Icon } from "../../components/Icon/Icon";
import { TextField } from "../../components/TextField/TextField";
import { useTranslation } from "../../i18n";
import styles from "./Topbar.module.css";

interface TopbarProps {
  query: string;
  onQueryChange: (next: string) => void;
  /** Hidden on the settings panel, where there is nothing to add. */
  onAdd?: () => void;
  onOpenSettings: () => void;
}

/** Search, the capture-exclusion indicator, and the two global actions. */
export function Topbar({ query, onQueryChange, onAdd, onOpenSettings }: TopbarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.topbar}>
      <TextField
        className={styles.search}
        label={t.topbar.search}
        placeholder={t.topbar.search}
        icon="search"
        height="md"
        face="body"
        surface="var(--abyss)"
        type="search"
        value={query}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onQueryChange(event.target.value)}
      />

      {/*
        Not decoration: it reports a real protection. The window is excluded from
        screen capture, so a viewer who cannot see that would have no way to know
        why their recording came out black.
      */}
      <div className={styles.captureBadge} title={t.topbar.captureBlocked}>
        <Icon name="screenshot_monitor" size={17} label={t.topbar.captureBlocked} />
        <Icon name="block" size={15} color="var(--danger)" />
      </div>

      {onAdd !== undefined && (
        <Button
          variant="primary"
          size="md"
          icon="add"
          sweep
          title={t.topbar.addTitle}
          onClick={onAdd}
        >
          {t.topbar.add}
        </Button>
      )}

      <Button
        variant="secondary"
        size="md"
        icon="tune"
        title={t.topbar.settings}
        onClick={onOpenSettings}
      />
    </div>
  );
}

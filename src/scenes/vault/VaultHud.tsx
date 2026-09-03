// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { Button } from "../../components/Button/Button";
import { EyebrowLabel } from "../../components/EyebrowLabel/EyebrowLabel";
import { Icon } from "../../components/Icon/Icon";
import { formatCountdown } from "../../hooks/useAutoLock";
import { useTranslation } from "../../i18n";
import styles from "./VaultHud.module.css";

interface VaultHudProps {
  /** Seconds until the automatic lock, or null when it is switched off. */
  remaining: number | null;
  onLock: () => void;
}

/**
 * The status block at the foot of the sidebar.
 *
 * It answers, without being asked, the two questions that matter while a vault
 * is open: is it open, and how long until it closes. A vault that gives no
 * feedback about its own state trains people to leave it unlocked.
 *
 * The countdown is deliberately not announced on every tick: a screen reader
 * reciting the seconds would be unusable. The state changes that matter —
 * locking, unlocking — are announced where they happen.
 */
export function VaultHud({ remaining, onLock }: VaultHudProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.hud}>
      <EyebrowLabel icon="lock_open" tone="safe" size="sm">
        {t.hud.unlocked}
      </EyebrowLabel>

      <div className={styles.row}>
        <Icon name="timer" size={15} />
        <span className={styles.value} aria-hidden>
          {remaining === null ? t.hud.countdownOff : formatCountdown(remaining)}
        </span>
      </div>

      <div className={styles.row}>
        <Icon name="memory" size={15} />
        <span className={styles.value}>{t.hud.memory}</span>
      </div>

      <Button
        variant="danger"
        size="sm"
        icon="lock"
        title={t.hud.lockNowTitle}
        onClick={onLock}
        className={styles.lockButton}
      >
        {t.hud.lockNow}
      </Button>
    </div>
  );
}

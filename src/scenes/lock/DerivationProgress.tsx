// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { EyebrowLabel } from "../../components/EyebrowLabel/EyebrowLabel";
import { useTranslation } from "../../i18n";
import styles from "./DerivationProgress.module.css";

interface DerivationProgressProps {
  /** Argon2 parameters, shown so the wait is legible rather than mysterious. */
  parameters: string;
  /** Milliseconds the bar takes to fill. */
  durationMs: number;
}

/**
 * What the user sees while the master key is being derived.
 *
 * Argon2id at a 256 MiB floor takes about a second by design, and a second of
 * nothing reads as a hang. Showing the cost parameters turns the wait into
 * evidence that the work is being done, which is the only honest way to make
 * deliberate slowness feel intentional.
 *
 * The bar is announced politely rather than as a progress value: it represents
 * elapsed time, not measured progress, and claiming otherwise would be a lie
 * told to a screen reader.
 */
export function DerivationProgress({ parameters, durationMs }: DerivationProgressProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.deriving} role="status" aria-live="polite">
      <EyebrowLabel icon="key_vertical" tone="gold" size="sm">
        {t.lock.deriving}
      </EyebrowLabel>
      <div className={styles.track}>
        <div
          data-anim="fill"
          className={styles.bar}
          style={{ "--derive-duration": `${durationMs}ms` } as React.CSSProperties}
        />
      </div>
      <div className={styles.detail}>
        {parameters}
        <br />
        {t.lock.derivingDetail}
      </div>
    </div>
  );
}

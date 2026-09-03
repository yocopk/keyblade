// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { Button } from "../../components/Button/Button";
import { EyebrowLabel } from "../../components/EyebrowLabel/EyebrowLabel";
import { useTranslation } from "../../i18n";
import styles from "./SecretField.module.css";

/** What a masked value looks like. Fixed width, so it reveals nothing about length. */
const MASK = "•••• •••• •••• ••••";

interface SecretFieldProps {
  label: string;
  value: string;
  /** Whether this field is a secret at all. */
  secret: boolean;
  /** Whether the user has chosen to reveal it. */
  revealed: boolean;
  onToggleReveal: () => void;
  onCopy: () => void;
  /** Seconds until the clipboard clears, when this field is the copied one. */
  copiedSeconds: number | null;
}

/**
 * One labelled value in the detail panel, with reveal and copy.
 *
 * The mask is a constant string rather than a run of dots matching the value:
 * a mask that grows with the secret leaks its length, which for a password is
 * the single most useful thing an observer can learn without reading it.
 */
export function SecretField({
  label,
  value,
  secret,
  revealed,
  onToggleReveal,
  onCopy,
  copiedSeconds,
}: SecretFieldProps) {
  const { t } = useTranslation();
  const hidden = secret && !revealed;
  const copied = copiedSeconds !== null;

  return (
    <div className={styles.field}>
      <div className={styles.head}>
        <EyebrowLabel>{label}</EyebrowLabel>
        <span className={styles.actions}>
          {secret && (
            <Button
              variant="secondary"
              size="sm"
              icon={hidden ? "visibility" : "visibility_off"}
              title={hidden ? t.detail.reveal : t.detail.hide}
              onClick={onToggleReveal}
            />
          )}
          <Button
            variant="quiet"
            size="sm"
            icon={copied ? "check" : "content_copy"}
            title={copied ? t.detail.copied : t.detail.copy}
            onClick={onCopy}
          >
            {copied ? <span className={styles.countdown}>{copiedSeconds}s</span> : undefined}
          </Button>
        </span>
      </div>
      <div className={styles.value} data-selectable={hidden ? undefined : true}>
        {hidden ? MASK : value}
      </div>
    </div>
  );
}

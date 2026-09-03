// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { Button } from "../../components/Button/Button";
import { Callout } from "../../components/Callout/Callout";
import { EyebrowLabel } from "../../components/EyebrowLabel/EyebrowLabel";
import { HatchPanel } from "../../components/HatchPanel/HatchPanel";
import { Icon, type IconName } from "../../components/Icon/Icon";
import { Modal } from "../../components/Modal/Modal";
import { TextField } from "../../components/TextField/TextField";
import { useTranslation } from "../../i18n";
import styles from "./ComposeDialog.module.css";

export interface ComposeField {
  key: string;
  label: string;
  icon: IconName;
  hint: string;
  value: string;
  /** Shows the generator button, for password fields. */
  generate?: () => void;
}

interface ComposeDialogProps {
  title: string;
  icon: IconName;
  /** Shows the file dropzone, for the blob-backed categories. */
  isFile: boolean;
  note: string;
  fields: readonly ComposeField[];
  onFieldChange: (key: string, value: string) => void;
  onPickFile: () => void;
  onCancel: () => void;
  onSave: () => void;
  /** False while the required name is empty. */
  canSave: boolean;
}

/** Adds an item to the vault. */
export function ComposeDialog({
  title,
  icon,
  isFile,
  note,
  fields,
  onFieldChange,
  onPickFile,
  onCancel,
  onSave,
  canSave,
}: ComposeDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal
      title={title}
      icon={icon}
      onClose={onCancel}
      closeLabel={t.compose.closeTitle}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onCancel}>
            {t.compose.cancel}
          </Button>
          <Button
            variant="primary"
            size="lg"
            icon="lock"
            title={t.compose.saveTitle}
            onClick={onSave}
            disabled={!canSave}
          >
            {t.compose.save}
          </Button>
        </>
      }
    >
      {isFile && (
        <HatchPanel>
          <button
            type="button"
            className={styles.dropzone}
            title={t.compose.dropzoneTitle}
            onClick={onPickFile}
          >
            <Icon name="upload_file" size={28} color="var(--gold)" />
            <span className={styles.dropzoneText}>
              {t.compose.dropzone}
              <br />
              <span className={styles.dropzoneNote}>{t.compose.dropzoneNote}</span>
            </span>
          </button>
        </HatchPanel>
      )}

      {fields.map((field) => (
        <div key={field.key} className={styles.field}>
          <EyebrowLabel>{field.label}</EyebrowLabel>
          <TextField
            label={field.label}
            placeholder={field.hint}
            icon={field.icon}
            surface="var(--sunken)"
            value={field.value}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onFieldChange(field.key, event.target.value)}
            trailing={
              field.generate !== undefined ? (
                <Button
                  variant="quiet"
                  size="sm"
                  icon="autorenew"
                  title={t.compose.generateTitle}
                  onClick={field.generate}
                />
              ) : undefined
            }
          />
        </div>
      ))}

      <Callout icon="enhanced_encryption">
        {t.compose.encryptionNote} {note}
      </Callout>
    </Modal>
  );
}

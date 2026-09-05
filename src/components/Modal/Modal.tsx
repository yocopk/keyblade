// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { useEffect, useId, useRef } from "react";

import { Button } from "../Button/Button";
import { Icon, type IconName } from "../Icon/Icon";
import styles from "./Modal.module.css";

interface ModalProps {
  title: string;
  icon: IconName;
  onClose: () => void;
  closeLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * A modal dialog.
 *
 * Three things the mock leaves out, because a static prototype cannot show them
 * and a real dialog is unusable without them: focus moves into the dialog when
 * it opens, Tab is trapped inside it while it is open, and focus returns to
 * whatever opened it on close.
 *
 * Escape is handled by the application, which already owns it for locking.
 */
export function Modal({ title, icon, onClose, closeLabel, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    // Prefer the first input over the first focusable. The first focusable is
    // the close button in the header, and opening a form with focus parked on
    // "cancel" means every keyboard user starts by tabbing past the way out.
    const firstInput = panel?.querySelector<HTMLElement>("input, textarea, select");
    const firstFocusable = panel?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (firstInput ?? firstFocusable)?.focus();

    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || panel === null) return;
      const stops = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      opener?.focus();
    };
  }, []);

  return (
    <div className={styles.backdrop}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        data-anim="modal-in"
        aria-labelledby={titleId}
        className={styles.panel}
      >
        <div className={styles.header}>
          <Icon name={icon} size={21} color="var(--gold)" />
          <span id={titleId} className={styles.title}>
            {title}
          </span>
          <Button variant="secondary" size="sm" icon="close" title={closeLabel} onClick={onClose} />
        </div>
        <div className={styles.body}>{children}</div>
        {footer !== undefined && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}

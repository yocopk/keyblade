// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { Icon, type IconName } from "../Icon/Icon";
import styles from "./Callout.module.css";

interface CalloutProps {
  icon: IconName;
  children: React.ReactNode;
  className?: string;
}

/** The gold-tinted explanatory box used beside forms and settings. */
export function Callout({ icon, children, className }: CalloutProps) {
  return (
    <div className={[styles.callout, className].filter(Boolean).join(" ")}>
      <Icon name={icon} size={18} color="var(--gold)" />
      <span className={styles.body}>{children}</span>
    </div>
  );
}

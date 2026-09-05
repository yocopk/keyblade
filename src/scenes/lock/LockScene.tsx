// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { useState } from "react";

import { Button } from "../../components/Button/Button";
import { EyebrowLabel } from "../../components/EyebrowLabel/EyebrowLabel";
import { Icon } from "../../components/Icon/Icon";
import { ParticleField } from "../../components/ParticleField/ParticleField";
import { StainedGlass } from "../../components/StainedGlass/StainedGlass";
import { TextField } from "../../components/TextField/TextField";
import { Wordmark } from "../../components/Wordmark/Wordmark";
import type { VaultSummary } from "../../data/types";
import { useTranslation } from "../../i18n";
import { DerivationProgress } from "./DerivationProgress";
import { VaultSwitcher } from "./VaultSwitcher";
import styles from "./LockScene.module.css";

/**
 * How long the fake derivation takes.
 *
 * Roughly what Argon2id costs at the 256 MiB floor, so the interface is built
 * around a real delay rather than discovering one later. M1 replaces the timer
 * with the actual call.
 */
export const DERIVATION_MS = 1100;

interface LockSceneProps {
  vaults: readonly VaultSummary[];
  selectedVault: number;
  onSelectVault: (index: number) => void;
  onUnlock: () => void;
  deriving: boolean;
  particles: boolean;
  animations: boolean;
  halo: boolean;
}

/**
 * The locked vault.
 *
 * The stained-glass window is the whole screen: it is drawn from this vault's
 * salt, so it is the same every time for this vault and different for every
 * other one. Before typing anything, the user has already been shown whether
 * this is the vault they think it is.
 */
export function LockScene({
  vaults,
  selectedVault,
  onSelectVault,
  onUnlock,
  deriving,
  particles,
  animations,
  halo,
}: LockSceneProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const vault = vaults[selectedVault];

  const submit = () => {
    if (deriving) return;
    onUnlock();
    setPassword("");
  };

  return (
    <div className={styles.scene}>
      <div aria-hidden data-anim="aura" className={styles.aura} />
      <ParticleField enabled={particles} animated={animations} count={54} bursting={deriving} />
      {deriving && <div aria-hidden data-anim="flash" className={styles.flash} />}

      <div className={styles.stack}>
        <div data-anim="glass-in" className={styles.glassFrame}>
          {halo && (
            <>
              <span aria-hidden data-anim="halo" className={styles.haloInner} />
              <span aria-hidden data-anim="halo-spin" className={styles.haloOuter} />
            </>
          )}
          <StainedGlass
            salt={vault.salt}
            size={452}
            label={`${t.lock.sigilCaption}: ${vault.fileName}`}
            className={styles.glass}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        <div data-anim="rise" className={styles.identity}>
          <EyebrowLabel icon="shield_lock" tone="gold" size="sm">
            {t.lock.eyebrow}
          </EyebrowLabel>
          <Wordmark />
          <div className={styles.vaultLabel} data-selectable>
            <Icon name="fingerprint" size={14} color="var(--faint)" />
            {vault.fileName} · salt {vault.salt}
          </div>
        </div>

        <div data-anim="rise" className={styles.form}>
          {deriving ? (
            <DerivationProgress
              parameters="argon2id · m=512 MiB · t=3 · p=4"
              durationMs={DERIVATION_MS}
            />
          ) : (
            <div className={styles.controls}>
              <TextField
                type="password"
                label={t.lock.passwordPlaceholder}
                placeholder={t.lock.passwordPlaceholder}
                icon="password"
                height="xl"
                surface="var(--field)"
                value={password}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submit();
                }}
                style={{ borderColor: "var(--edge-gold)" }}
              />
              <Button
                variant="primary"
                size="xl"
                icon="vpn_key"
                sweep
                title={t.lock.openTitle}
                onClick={submit}
              >
                {t.lock.open}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                icon="face"
                title={t.lock.helloTitle}
                onClick={submit}
              >
                {t.lock.hello}
              </Button>
            </div>
          )}

          <div className={styles.hint}>{deriving ? "" : t.lock.hint}</div>
        </div>

        <div data-anim="rise" className={styles.switcher}>
          <EyebrowLabel icon="deployed_code">{t.lock.sigilCaption}</EyebrowLabel>
          <VaultSwitcher
            vaults={vaults}
            selectedIndex={selectedVault}
            onSelect={onSelectVault}
          />
        </div>
      </div>
    </div>
  );
}

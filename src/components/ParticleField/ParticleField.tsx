// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2026 Andrea Marchese

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  phase: number;
  speed: number;
  gold: boolean;
}

interface ParticleFieldProps {
  /** Off entirely: no canvas work, no animation frame. */
  enabled: boolean;
  /** When false the particles are painted once and left still. */
  animated: boolean;
  /** How many. The lock screen carries more than the vault behind content. */
  count?: number;
  /** Dims the whole field, so it can sit behind a working interface. */
  intensity?: number;
  /** While true the particles are pushed outward from the centre. */
  bursting?: boolean;
}

/**
 * The drifting motes behind the lock screen and the vault.
 *
 * Purely decorative, and the first thing the Effects switch turns off. It draws
 * to a canvas rather than animating DOM nodes because fifty translating elements
 * would keep the compositor busy for no reason, and because a canvas can be
 * skipped entirely with one early return.
 */
export function ParticleField({
  enabled,
  animated,
  count = 54,
  intensity = 1,
  bursting = false,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  // Read inside the animation frame so changing them does not restart the loop.
  const settings = useRef({ animated, count, intensity, bursting });
  settings.current = { animated, count, intensity, bursting };

  useEffect(() => {
    if (!enabled) {
      particlesRef.current = [];
      return;
    }

    let frame = 0;

    const render = () => {
      frame = requestAnimationFrame(render);
      const canvas = canvasRef.current;
      if (canvas === null) return;

      const context = canvas.getContext("2d");
      if (context === null) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(width * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const { animated: moving, count: wanted, intensity: alpha, bursting: burst } = settings.current;
      const particles = particlesRef.current;

      while (particles.length < wanted) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 0.6 + Math.random() * 1.9,
          vx: (Math.random() - 0.5) * 0.16,
          vy: -(0.1 + Math.random() * 0.34),
          phase: Math.random() * Math.PI * 2,
          speed: 0.008 + Math.random() * 0.02,
          gold: Math.random() < 0.45,
        });
      }
      if (particles.length > wanted) particles.length = wanted;

      const focusX = width / 2;
      const focusY = height * 0.42;

      for (const particle of particles) {
        if (moving) {
          particle.phase += particle.speed;
          particle.y += particle.vy;
          particle.x += particle.vx + Math.sin(particle.phase) * 0.22;

          if (burst) {
            const dx = particle.x - focusX;
            const dy = particle.y - focusY;
            const distance = Math.hypot(dx, dy) || 1;
            particle.x += (dx / distance) * 2.6;
            particle.y += (dy / distance) * 2.6;
          }

          if (particle.y < -8) {
            particle.y = height + 8;
            particle.x = Math.random() * width;
          }
          if (particle.x < -8) particle.x = width + 8;
          else if (particle.x > width + 8) particle.x = -8;
        }

        const glow = (0.2 + 0.55 * (0.5 + 0.5 * Math.sin(particle.phase))) * alpha;
        const size = particle.radius * (alpha < 1 ? 0.8 : 1);

        const halo = context.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          size * 5,
        );
        halo.addColorStop(
          0,
          particle.gold
            ? `rgba(232, 193, 112, ${glow.toFixed(3)})`
            : `rgba(243, 237, 223, ${(glow * 0.8).toFixed(3)})`,
        );
        halo.addColorStop(1, "rgba(232, 193, 112, 0)");
        context.fillStyle = halo;
        context.beginPath();
        context.arc(particle.x, particle.y, size * 5, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = particle.gold ? "#e8c170" : "#f3eddf";
        context.globalAlpha = Math.min(1, glow + 0.15);
        context.beginPath();
        context.arc(particle.x, particle.y, size * 0.55, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
      }
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}

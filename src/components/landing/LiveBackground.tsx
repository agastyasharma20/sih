'use client';

import { useEffect, useRef } from 'react';

/**
 * Layered atmospheric background for the hero.
 *
 * Three layers drawn into one canvas, cheapest first:
 *
 *   1. Aurora — a few broad, slowly drifting colour fields. Sine-summed
 *      rather than random so the movement is organic instead of jittery.
 *   2. Depth field — particles in three parallax bands. Distant ones are
 *      small, dim and slow; near ones larger and faster. That difference
 *      is what reads as depth rather than confetti.
 *   3. Constellation — links between near particles only, so the lines
 *      sit in front of the haze instead of through it.
 *
 * The whole thing leans very slightly toward the pointer, which is the
 * single cheapest trick that makes a background feel alive.
 *
 * Cost control, because this runs on students' phones:
 *   - one canvas, never DOM nodes;
 *   - stops dead when the tab is hidden or the hero scrolls away;
 *   - draws one static frame under prefers-reduced-motion;
 *   - particle count scales to viewport area, clamped at both ends;
 *   - device pixel ratio capped at 2;
 *   - link-finding is limited to the near band, keeping the O(n²) pass
 *     over a small n rather than every particle.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 0 = far, 2 = near. Drives size, speed, opacity and parallax. */
  band: number;
}

const BANDS = [
  { speed: 0.08, radius: [0.4, 0.9], alpha: 0.25, parallax: 4 },
  { speed: 0.16, radius: [0.8, 1.5], alpha: 0.4, parallax: 10 },
  { speed: 0.28, radius: [1.2, 2.2], alpha: 0.62, parallax: 20 },
] as const;

const AURORA = [
  { hue: 'rgba(46, 99, 255,',  speed: 0.00007, radius: 0.55 },
  { hue: 'rgba(255, 153, 51,', speed: 0.00005, radius: 0.42 },
  { hue: 'rgba(19, 136, 8,',   speed: 0.00009, radius: 0.38 },
] as const;

export function LiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let frame = 0;
    let running = false;
    let particles: Particle[] = [];

    // Where the pointer is, and where the scene has eased to. Easing stops
    // the parallax snapping when the pointer jumps.
    let pointerX = 0;
    let pointerY = 0;
    let easedX = 0;
    let easedY = 0;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas!.getBoundingClientRect();

      width = rect.width;
      height = rect.height;
      canvas!.width = Math.floor(width * ratio);
      canvas!.height = Math.floor(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);

      const count = Math.max(30, Math.min(110, Math.round((width * height) / 12000)));

      particles = Array.from({ length: count }, () => {
        // Weighted toward the far band, so depth reads correctly: many
        // distant specks, a few near ones.
        const roll = Math.random();
        const band = roll < 0.5 ? 0 : roll < 0.82 ? 1 : 2;
        const spec = BANDS[band];
        const angle = Math.random() * Math.PI * 2;

        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * spec.speed,
          vy: Math.sin(angle) * spec.speed,
          r: spec.radius[0] + Math.random() * (spec.radius[1] - spec.radius[0]),
          band,
        };
      });
    }

    function drawAurora(time: number) {
      for (let i = 0; i < AURORA.length; i += 1) {
        const layer = AURORA[i];
        const t = time * layer.speed;

        // Two out-of-phase sines per axis: the path never repeats visibly
        // and never looks like a circle.
        const cx = width * (0.5 + 0.28 * Math.sin(t + i * 2.1) + 0.1 * Math.sin(t * 1.7));
        const cy = height * (0.45 + 0.22 * Math.cos(t * 1.3 + i) + 0.08 * Math.cos(t * 2.1));
        const radius = Math.max(width, height) * layer.radius;

        const gradient = context!.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, `${layer.hue} 0.16)`);
        gradient.addColorStop(0.5, `${layer.hue} 0.05)`);
        gradient.addColorStop(1, `${layer.hue} 0)`);

        context!.fillStyle = gradient;
        context!.fillRect(0, 0, width, height);
      }
    }

    function draw(time: number) {
      context!.clearRect(0, 0, width, height);
      drawAurora(time);

      // Ease the scene toward the pointer.
      easedX += (pointerX - easedX) * 0.04;
      easedY += (pointerY - easedY) * 0.04;

      const near: Particle[] = [];

      for (const p of particles) {
        const spec = BANDS[p.band];
        const ox = easedX * spec.parallax;
        const oy = easedY * spec.parallax;

        context!.fillStyle = `rgba(198, 216, 255, ${spec.alpha})`;
        context!.beginPath();
        context!.arc(p.x + ox, p.y + oy, p.r, 0, Math.PI * 2);
        context!.fill();

        if (p.band === 2) near.push(p);
      }

      // Links between the near band only — few enough that the pairwise
      // pass stays cheap, and they read as foreground structure.
      const ox = easedX * BANDS[2].parallax;
      const oy = easedY * BANDS[2].parallax;

      for (let i = 0; i < near.length; i += 1) {
        for (let j = i + 1; j < near.length; j += 1) {
          const dx = near[i].x - near[j].x;
          const dy = near[i].y - near[j].y;
          const distance = Math.hypot(dx, dy);
          if (distance >= 150) continue;

          context!.strokeStyle = `rgba(150, 185, 255, ${0.22 * (1 - distance / 150)})`;
          context!.lineWidth = 1;
          context!.beginPath();
          context!.moveTo(near[i].x + ox, near[i].y + oy);
          context!.lineTo(near[j].x + ox, near[j].y + oy);
          context!.stroke();
        }
      }
    }

    function step(time: number) {
      if (!running) return;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap generously, so nothing pops in at an edge.
        const margin = 24;
        if (p.x < -margin) p.x = width + margin;
        if (p.x > width + margin) p.x = -margin;
        if (p.y < -margin) p.y = height + margin;
        if (p.y > height + margin) p.y = -margin;
      }

      draw(time);
      frame = requestAnimationFrame(step);
    }

    function start() {
      if (running || reduced) return;
      running = true;
      frame = requestAnimationFrame(step);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(frame);
    }

    function onPointerMove(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      // -1..1 from the centre.
      pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    }

    resize();
    reduced ? draw(0) : start();

    const onResize = () => {
      resize();
      if (reduced) draw(0);
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0 },
    );
    observer.observe(canvas);

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    // Coarse pointers have no hover, so the parallax would never fire and
    // the listener would only cost battery.
    const fine = window.matchMedia('(pointer: fine)').matches;
    if (fine && !reduced) window.addEventListener('pointermove', onPointerMove, { passive: true });

    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

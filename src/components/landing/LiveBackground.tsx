'use client';

import { useEffect, useRef } from 'react';

/**
 * Animated particle field behind the hero.
 *
 * Canvas rather than DOM nodes: sixty animated elements would thrash
 * layout, one canvas does not. It is also written to be a good citizen on
 * a phone —
 *
 *  - stops entirely when the tab is hidden or the hero scrolls away, so
 *    it never burns battery in the background,
 *  - honours prefers-reduced-motion by drawing one static frame,
 *  - scales particle count to the viewport rather than using a fixed
 *    number that would be dense on mobile and sparse on a monitor,
 *  - caps the device pixel ratio at 2, since beyond that the cost is real
 *    and the difference is not visible.
 */
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
    let running = true;

    type Particle = { x: number; y: number; vx: number; vy: number; r: number };
    let particles: Particle[] = [];

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas!.getBoundingClientRect();

      width = rect.width;
      height = rect.height;

      canvas!.width = Math.floor(width * ratio);
      canvas!.height = Math.floor(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);

      // Roughly one particle per 18,000 css pixels, clamped so neither a
      // phone nor an ultrawide gets something silly.
      const count = Math.max(18, Math.min(70, Math.round((width * height) / 18000)));

      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.6 + 0.7,
      }));
    }

    function draw() {
      context!.clearRect(0, 0, width, height);

      // Link nearby particles. O(n²), but n is capped at 70.
      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];

        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);

          if (distance < 130) {
            context!.strokeStyle = `rgba(148, 180, 255, ${0.16 * (1 - distance / 130)})`;
            context!.lineWidth = 1;
            context!.beginPath();
            context!.moveTo(a.x, a.y);
            context!.lineTo(b.x, b.y);
            context!.stroke();
          }
        }

        context!.fillStyle = 'rgba(190, 212, 255, 0.55)';
        context!.beginPath();
        context!.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        context!.fill();
      }
    }

    function step() {
      if (!running) return;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap rather than bounce: no visible edge to the field.
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
      }

      draw();
      frame = requestAnimationFrame(step);
    }

    function start() {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(step);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(frame);
    }

    resize();

    if (reduced) {
      // One frame, then nothing moves.
      draw();
    } else {
      frame = requestAnimationFrame(step);
    }

    const onResize = () => {
      resize();
      if (reduced) draw();
    };

    const onVisibility = () => (document.hidden ? stop() : !reduced && start());

    // Stop once the hero has scrolled out of view.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (reduced) return;
        entry.isIntersecting ? start() : stop();
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
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

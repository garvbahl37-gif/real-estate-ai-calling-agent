"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * The signature element.
 *
 * In Devanagari the शिरोरेखा is the horizontal stroke drawn across the top of a
 * word — it is what binds separate letters into a single unit. This component
 * is that stroke, and during a live call it becomes the waveform: dead flat
 * when nothing is happening, teal when the agent speaks, magenta when the
 * caller does. One line doing the work of a status light, a VU meter and a rule.
 *
 * Levels arrive from the audio worklets ~60 times a second. They are passed in
 * as a ref that the parent mutates from its event callback rather than as
 * props, so a talking agent does not trigger 60 React renders per second — the
 * canvas reads the current value inside its own animation frame.
 */

const BUCKETS = 220;

export interface AudioLevels {
  mic: number;
  agent: number;
}

export interface ShirorekhaProps {
  levelsRef: RefObject<AudioLevels>;
  active: boolean;
  height?: number;
  className?: string;
}

export function Shirorekha({ levelsRef, active, height = 56, className }: ShirorekhaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const history: { v: number; who: 0 | 1 | 2 }[] = Array.from({ length: BUCKETS }, () => ({ v: 0, who: 0 }));
    let raf = 0;
    let smoothMic = 0;
    let smoothAgent = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const isActive = activeRef.current;
      const { mic, agent } = levelsRef.current;

      // Attack fast, release slow. A meter that drops instantly reads as
      // jittery; one that rises slowly reads as laggy.
      smoothMic += (mic - smoothMic) * (mic > smoothMic ? 0.55 : 0.12);
      smoothAgent += (agent - smoothAgent) * (agent > smoothAgent ? 0.55 : 0.12);

      // RMS on speech sits low. This curve lifts it into a usable range without
      // letting loud passages clip the full height.
      const shape = (v: number) => Math.min(1, Math.pow(v * 7.5, 0.72));
      const m = isActive ? shape(smoothMic) : 0;
      const a = isActive ? shape(smoothAgent) : 0;

      const who: 0 | 1 | 2 = a > 0.05 ? 2 : m > 0.05 ? 1 : 0;
      history.push({ v: Math.max(m, a), who });
      history.shift();

      const w = canvas.clientWidth;
      const h = height;
      const mid = h / 2;
      ctx.clearRect(0, 0, w, h);

      const step = w / BUCKETS;
      const maxAmp = h / 2 - 3;

      // The baseline is the rule itself, always drawn — an idle call still
      // reads as a piece of typography rather than an empty box.
      ctx.strokeStyle = "#dcd8cf";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();

      if (!isActive) {
        raf = requestAnimationFrame(draw);
        return;
      }

      // Newest on the right, fading toward the left edge.
      for (let i = 0; i < BUCKETS; i++) {
        const { v, who: w2 } = history[i];
        if (v < 0.02) continue;
        const x = i * step;
        const amp = v * maxAmp;
        ctx.globalAlpha = 0.15 + (i / BUCKETS) * 0.85;
        ctx.strokeStyle = w2 === 2 ? "#0b6e6e" : w2 === 1 ? "#c21e56" : "#dcd8cf";
        ctx.lineWidth = Math.max(1.25, step * 0.62);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, mid - amp);
        ctx.lineTo(x, mid + amp);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [height, levelsRef]);

  return <canvas ref={canvasRef} className={className} style={{ width: "100%", height }} aria-hidden />;
}

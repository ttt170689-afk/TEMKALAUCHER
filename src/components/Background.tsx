import { useEffect, useRef } from "react";
import { useSettings } from "../lib/settings";

interface P {
  x: number;
  y: number;
  r: number;
  vy: number;
  sway: number;
  phase: number;
  color: string;
  alpha: number;
}

function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export default function Background() {
  const { s } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowARef = useRef<HTMLDivElement>(null);
  const glowBRef = useRef<HTMLDivElement>(null);
  const { particles, particleDensity, reducedMotion, accent } = s;

  // параллакс свечений за курсором
  useEffect(() => {
    if (reducedMotion) return;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const loop = () => {
      cur.x += (target.x - cur.x) * 0.04;
      cur.y += (target.y - cur.y) * 0.04;
      if (glowARef.current) glowARef.current.style.transform = `translate(${cur.x * 26}px, ${cur.y * 18}px)`;
      if (glowBRef.current) glowBRef.current.style.transform = `translate(${cur.x * -34}px, ${cur.y * -22}px)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
    };
  }, [reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!particles) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let pts: P[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const colors = [rgba(accent, 1), rgba("#3ddcc2", 1), "rgba(233,237,245,1)"];

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      pts = Array.from({ length: particleDensity }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.9,
        vy: 0.12 + Math.random() * 0.35,
        sway: 8 + Math.random() * 22,
        phase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.12 + Math.random() * 0.4,
      }));
    };

    interface Meteor {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      max: number;
    }
    const meteors: Meteor[] = [];
    let nextMeteor = 2500 + Math.random() * 3000;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        const x = p.x + Math.sin(t / 2400 + p.phase) * p.sway;
        let y = reducedMotion ? p.y : p.y - (t / 16) * p.vy * 0.12;
        y = ((y % (h + 20)) + h + 20) % (h + 20) - 10;
        const tw = reducedMotion ? 1 : 0.65 + 0.35 * Math.sin(t / 700 + p.phase);
        ctx.globalAlpha = p.alpha * tw;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // метеоры
      if (!reducedMotion) {
        if (t > nextMeteor) {
          nextMeteor = t + 5000 + Math.random() * 6000;
          meteors.push({
            x: Math.random() * w * 0.7,
            y: -30,
            vx: 5 + Math.random() * 4,
            vy: 3 + Math.random() * 2.5,
            life: 0,
            max: 70 + Math.random() * 40,
          });
        }
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i];
          m.life++;
          m.x += m.vx;
          m.y += m.vy;
          if (m.life > m.max || m.x > w + 60 || m.y > h + 60) {
            meteors.splice(i, 1);
            continue;
          }
          const k = Math.sin((m.life / m.max) * Math.PI);
          const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 9, m.y - m.vy * 9);
          grad.addColorStop(0, rgba(accent, 0.85 * k));
          grad.addColorStop(1, rgba(accent, 0));
          ctx.globalAlpha = 1;
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - m.vx * 9, m.y - m.vy * 9);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    resize();
    seed();
    if (reducedMotion) {
      draw(0);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const onResize = () => {
      resize();
      seed();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [particles, particleDensity, reducedMotion, accent]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      {/* base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 70% -10%, color-mix(in srgb, var(--accent) 7%, var(--bg0)) 0%, var(--bg0) 55%), linear-gradient(180deg, var(--bg0), var(--bg0))",
        }}
      />
      {/* ambient glows с параллаксом */}
      <div ref={glowARef} className="absolute inset-0 will-change-transform">
        <div
          className="float-slow absolute -left-40 -top-40 h-[55vmax] w-[55vmax] rounded-full"
          style={{
            background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 13%, transparent) 0%, transparent 62%)",
          }}
        />
      </div>
      <div ref={glowBRef} className="absolute inset-0 will-change-transform">
        <div
          className="float-slow absolute -bottom-48 -right-40 h-[60vmax] w-[60vmax] rounded-full"
          style={{
            background: "radial-gradient(circle, color-mix(in srgb, var(--accent-2) 9%, transparent) 0%, transparent 60%)",
            animationDelay: "-7s",
          }}
        />
      </div>
      <div className="grid-overlay" />
      <div className="scanline" />
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="noise" />
    </div>
  );
}

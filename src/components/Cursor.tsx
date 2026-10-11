import { useEffect, useRef, useState } from "react";
import { useSettings } from "../lib/settings";

const HOVER_SEL = "a, button, [role='button'], input, select, textarea, label, [data-cursor]";
const TEXT_SEL = "input, textarea, select";
const DANGER_SEL = '[aria-disabled="true"]';

type Mode = "idle" | "hover" | "text" | "danger";

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
  drag: number;
}
interface Wave {
  x: number;
  y: number;
  r: number;
  max: number;
  color: string;
  soft?: boolean;
}

const CIRC = 2 * Math.PI * 40;
const GOLD = "#ffd76a";

export default function Cursor() {
  const { s } = useSettings();
  const level = 0; // progression is disabled

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const dotCoreRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<HTMLDivElement>(null);
  const arc2Ref = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const slashRef = useRef<HTMLDivElement>(null);
  const bracketsRef = useRef<HTMLDivElement>(null);
  const chargeRef = useRef<SVGCircleElement>(null);
  const chargeWrapRef = useRef<HTMLDivElement>(null);

  const mouse = useRef({ x: -200, y: -200 });
  const prev = useRef({ x: -200, y: -200 });
  const vel = useRef({ x: 0, y: 0 });
  const ringPos = useRef({ x: -200, y: -200 });
  const rot = useRef(0);
  const energy = useRef(0);
  const boost = useRef(0);
  const lastMove = useRef(0);
  const hoverRect = useRef<DOMRect | null>(null);
  const modeRef = useRef<Mode>("idle");
  const downRef = useRef(false);
  const levelRef = useRef(level);
  levelRef.current = level;

  const [visible, setVisible] = useState(false);

  // взрыв при повышении уровня
  const burstRef = useRef<((x: number, y: number) => void) | null>(null);
  const firstLevel = useRef(true);
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false;
      return;
    }
    burstRef.current?.(mouse.current.x, mouse.current.y);
  }, [level]);

  const enabled = s.customCursor;
  const trailOn = s.cursorTrail;
  const ribbonOn = s.cursorRibbon;
  const chargeOn = s.cursorCharge;
  const ringSize = s.ringSize;
  const reduced = s.reducedMotion;
  const glowOn = s.cursorGlow;
  const tagOn = s.playerTag;

  useEffect(() => {
    if (!enabled) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      if (canvas) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    resize();

    let raf = 0;
    const parts: Part[] = [];
    const waves: Wave[] = [];
    const ribbon: { x: number; y: number }[] = [];
    const ghosts: { x: number; y: number }[] = [];
    let lastBeat = 0;

    burstRef.current = (x, y) => {
      const a = readVar("--accent", "#ff7a2f");
      const a2 = readVar("--accent-2", "#3ddcc2");
      burst(x, y, levelRef.current >= 10 ? "#ffd76a" : a, a2);
    };

    const readVar = (name: string, fallback: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

    const emitSpark = (x: number, y: number, vx: number, vy: number, accent: string, accent2: string) => {
      if (parts.length > 220) parts.shift();
      const roll = Math.random();
      parts.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx,
        vy,
        life: 0,
        max: 26 + Math.random() * 26,
        size: 1.4 + Math.random() * 2.6,
        color: roll > 0.42 ? accent : roll > 0.16 ? accent2 : "#ffffff",
        grav: 0.045,
        drag: 0.965,
      });
    };

    const emitWave = (x: number, y: number, max: number, color: string, soft = false) => {
      waves.push({ x, y, r: 6, max, color, soft });
    };

    const burst = (x: number, y: number, accent: string, accent2: string) => {
      emitWave(x, y, ringSize * 4.6, accent);
      emitWave(x, y, ringSize * 2.8, accent2);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + Math.random() * 0.3;
        const sp = 2.2 + Math.random() * 4.2;
        emitSpark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, accent, accent2);
      }
    };

    const loop = (t: number) => {
      const accent = readVar("--accent", "#ff7a2f");
      const accent2 = readVar("--accent-2", "#3ddcc2");
      const lvl = levelRef.current;
      const gold = lvl >= 10;

      const vx = mouse.current.x - prev.current.x;
      const vy = mouse.current.y - prev.current.y;
      const v = Math.hypot(vx, vy);
      vel.current.x += (vx - vel.current.x) * 0.25;
      vel.current.y += (vy - vel.current.y) * 0.25;
      prev.current = { ...mouse.current };

      // магнит
      let tx = mouse.current.x;
      let ty = mouse.current.y;
      const r = hoverRect.current;
      if (r && modeRef.current === "hover") {
        tx += (r.left + r.width / 2 - tx) * 0.32;
        ty += (r.top + r.height / 2 - ty) * 0.32;
      }
      ringPos.current.x += (tx - ringPos.current.x) * 0.16;
      ringPos.current.y += (ty - ringPos.current.y) * 0.16;

      ghosts.unshift({ x: ringPos.current.x, y: ringPos.current.y });
      if (ghosts.length > 12) ghosts.length = 12;

      const idle = lastMove.current > 0 && t - lastMove.current > 2600;
      const mode = modeRef.current;

      // энергия
      if (chargeOn && mode !== "text") {
        energy.current = Math.max(0, Math.min(100, energy.current + v * 0.055 - (v < 0.5 ? 0.06 : 0)));
        if (energy.current >= 100) {
          energy.current = 0;
          boost.current = 1;
          if (!reduced) burst(mouse.current.x, mouse.current.y, accent, accent2);
        }
      } else {
        energy.current = Math.max(0, energy.current - 0.4);
      }
      boost.current *= 0.88;

      if (!reduced) rot.current += (mode === "hover" ? 2.6 : mode === "danger" ? 1.4 : 0.7) + v * 0.09;

      // ===== DOM-кольцо =====
      let scale = mode === "hover" ? 1.55 : mode === "danger" ? 1.12 : 1;
      if (downRef.current) scale *= 0.76;
      scale += Math.min(v * 0.004, 0.16) + boost.current * 0.5;
      if (idle && !reduced) scale += Math.sin(t / 460) * 0.07;

      // растяжение по скорости
      const ang = Math.atan2(vel.current.y, vel.current.x) * (180 / Math.PI);
      const stretchX = 1 + Math.min(v * 0.007, 0.24);
      const stretchY = 1 - Math.min(v * 0.005, 0.14);

      if (dotRef.current) dotRef.current.style.transform = `translate(${mouse.current.x}px, ${mouse.current.y}px)`;
      if (ringRef.current) ringRef.current.style.transform = `translate(${ringPos.current.x}px, ${ringPos.current.y}px)`;
      if (arcRef.current) {
        arcRef.current.style.transform = `rotate(${rot.current}deg)`;
        arcRef.current.style.opacity = mode === "text" ? "0" : mode === "danger" ? "0.3" : "1";
      }
      if (arc2Ref.current) {
        arc2Ref.current.style.transform = `rotate(${-rot.current * 1.6}deg)`;
        arc2Ref.current.style.opacity = mode === "text" || mode === "danger" ? "0" : "0.6";
      }
      if (coreRef.current) {
        coreRef.current.style.transform = `rotate(${ang}deg) scale(${scale * stretchX}, ${scale * stretchY})`;
        coreRef.current.style.opacity = mode === "text" ? "0" : "1";
        coreRef.current.style.borderColor =
          mode === "danger"
            ? "var(--danger)"
            : gold
              ? GOLD
              : mode === "hover"
                ? "color-mix(in srgb, var(--accent) 80%, transparent)"
                : "color-mix(in srgb, var(--tx) 65%, transparent)";
        coreRef.current.style.boxShadow = `inset 0 0 ${16 + lvl}px color-mix(in srgb, ${mode === "danger" ? "var(--danger)" : gold ? GOLD : "var(--accent)"} ${20 + lvl}%, transparent)`;
      }
      if (dotCoreRef.current) {
        dotCoreRef.current.style.opacity = mode === "text" ? "0" : "1";
        dotCoreRef.current.style.background = mode === "danger" ? "var(--danger)" : gold ? GOLD : "var(--accent)";
      }
      if (beamRef.current) beamRef.current.style.opacity = mode === "text" ? "1" : "0";
      if (slashRef.current) slashRef.current.style.opacity = mode === "danger" ? "1" : "0";
      if (bracketsRef.current) {
        bracketsRef.current.style.opacity = mode === "hover" ? "1" : "0";
        bracketsRef.current.style.transform = `scale(${mode === "hover" ? 1 : 0.7})`;
      }
      if (glowRef.current) {
        const aura = 1 + Math.min(lvl * 0.045, 0.5);
        const base = !glowOn ? 0 : mode === "text" ? 0.16 : mode === "danger" ? 0.4 : mode === "hover" ? 0.55 : idle ? 0.42 : 0.3;
        glowRef.current.style.opacity = String(Math.min(0.85, base + boost.current * 0.4));
        glowRef.current.style.transform = `scale(${(1 + Math.min(v * 0.006, 0.45) + boost.current * 0.5) * aura})`;
      }
      if (chargeWrapRef.current)
        chargeWrapRef.current.style.opacity = !chargeOn || mode === "text" || energy.current < 2 ? "0" : "0.95";
      if (chargeRef.current) {
        chargeRef.current.style.strokeDashoffset = String(CIRC * (1 - energy.current / 100));
        chargeRef.current.style.stroke = gold ? GOLD : energy.current > 75 ? accent2 : accent;
      }

      // ===== канвас: хвост, искры, волны, орбиталы =====
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = "lighter";

        // призрачные кольца-послеобразы на скорости
        if (!reduced && v > 7) {
          for (let i = 2; i < ghosts.length; i += 2) {
            const g = ghosts[i];
            const k = 1 - i / ghosts.length;
            ctx.globalAlpha = k * 0.14;
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(g.x, g.y, (ringSize / 2) * (0.55 + 0.45 * (i / ghosts.length)), 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // всасывание энергии с элемента при наведении
        if (!reduced && mode === "hover" && hoverRect.current && Math.random() < 0.55) {
          const hr = hoverRect.current;
          const side = Math.floor(Math.random() * 4);
          let px = hr.left;
          let py = hr.top;
          if (side === 0) {
            px = hr.left + Math.random() * hr.width;
          } else if (side === 1) {
            px = hr.left + Math.random() * hr.width;
            py = hr.top + hr.height;
          } else if (side === 2) {
            py = hr.top + Math.random() * hr.height;
          } else {
            px = hr.left + hr.width;
            py = hr.top + Math.random() * hr.height;
          }
          const dx = ringPos.current.x - px;
          const dy = ringPos.current.y - py;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const sp = 2.4 + Math.random() * 1.8;
          emitSpark(px, py, (dx / dist) * sp, (dy / dist) * sp, accent2, accent);
        }

        // спокойное «сердцебиение» в простое
        if (!reduced && idle && t - lastBeat > 1400) {
          lastBeat = t;
          emitWave(ringPos.current.x, ringPos.current.y, ringSize * 2.6, accent, true);
        }

        // хвост кометы
        if (ribbonOn && !reduced) {
          ribbon.unshift({ x: ringPos.current.x, y: ringPos.current.y });
          if (ribbon.length > 26) ribbon.length = 26;
          for (let i = 1; i < ribbon.length; i++) {
            const p0 = ribbon[i - 1];
            const p1 = ribbon[i];
            const k = 1 - i / ribbon.length;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.lineCap = "round";
            ctx.strokeStyle = i % 3 === 0 ? accent2 : accent;
            ctx.globalAlpha = k * k * (i % 3 === 0 ? 0.22 : 0.5);
            ctx.lineWidth = 0.6 + k * k * (4.6 + Math.min(v * 0.06, 3));
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }

        // искры
        if (!reduced) {
          for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i];
            p.life++;
            if (p.life >= p.max) {
              parts.splice(i, 1);
              continue;
            }
            p.vy += p.grav;
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.x += p.vx;
            p.y += p.vy;
            const k = 1 - p.life / p.max;
            ctx.globalAlpha = k * 0.95;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, Math.PI * 2);
            ctx.fill();
          }

          // ударные волны
          for (let i = waves.length - 1; i >= 0; i--) {
            const wv = waves[i];
            wv.r += (wv.max - wv.r) * 0.12;
            const k = 1 - wv.r / wv.max;
            if (k <= 0.02) {
              waves.splice(i, 1);
              continue;
            }
            ctx.globalAlpha = k * (wv.soft ? 0.3 : 0.85);
            ctx.strokeStyle = wv.color;
            ctx.lineWidth = 1 + k * 3;
            ctx.beginPath();
            ctx.arc(wv.x, wv.y, wv.r, 0, Math.PI * 2);
            ctx.stroke();
          }

          // орбиталы (число растёт с уровнем)
          if (mode !== "text") {
            const n = gold ? 6 : lvl >= 6 ? 4 : lvl >= 3 ? 3 : lvl >= 1 ? 2 : 1;
            for (let i = 0; i < n; i++) {
              const a = t / (700 + i * 260) + (i * Math.PI * 2) / n;
              const rad = ringSize / 2 + 15 + i * 6;
              const ox = ringPos.current.x + Math.cos(a) * rad;
              const oy = ringPos.current.y + Math.sin(a) * rad;
              const c = gold ? GOLD : i % 2 ? accent2 : accent;
              ctx.globalAlpha = 0.9;
              ctx.fillStyle = c;
              ctx.beginPath();
              ctx.arc(ox, oy, gold ? 3 : 2.4, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 0.35;
              ctx.beginPath();
              ctx.arc(ox, oy, 6.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }
      }

      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      lastMove.current = performance.now();
      setVisible(true);

      const el = e.target as HTMLElement | null;
      const hit = el?.closest?.(HOVER_SEL) as HTMLElement | null;
      const dangerous = !!(el?.closest?.(DANGER_SEL) || hit?.closest?.(DANGER_SEL));
      if (hit) {
        if (dangerous) {
          hoverRect.current = null;
          modeRef.current = "danger";
        } else {
          hoverRect.current = hit.getBoundingClientRect();
          modeRef.current = hit.matches(TEXT_SEL) ? "text" : "hover";
        }
      } else {
        hoverRect.current = null;
        modeRef.current = "idle";
      }

      // искры от скорости
      if (trailOn && !reduced) {
        const vxm = e.clientX - prev.current.x;
        const vym = e.clientY - prev.current.y;
        const vm = Math.hypot(vxm, vym);
        const n = Math.min(4, Math.floor(vm / 9));
        const accent = readVar("--accent", "#ff7a2f");
        const accent2 = readVar("--accent-2", "#3ddcc2");
        for (let i = 0; i < n; i++) {
          emitSpark(
            e.clientX,
            e.clientY,
            -vxm * 0.12 + (Math.random() - 0.5) * 2.2,
            -vym * 0.12 + (Math.random() - 0.5) * 2.2 + 0.4,
            accent,
            accent2
          );
        }
      }

      // красные искры над недоступными элементами
      if (!reduced && modeRef.current === "danger" && Math.random() < 0.35) {
        emitSpark(e.clientX, e.clientY, (Math.random() - 0.5) * 2.4, -Math.random() * 2, "#ff5d5d", "#ff8a5d");
      }
    };

    const onDown = (e: MouseEvent) => {
      downRef.current = true;
      if (!reduced) {
        const accent = readVar("--accent", "#ff7a2f");
        const danger = modeRef.current === "danger";
        emitWave(e.clientX, e.clientY, ringSize * 2.6, danger ? "#ff5d5d" : accent);
      }
    };
    const onUp = () => {
      downRef.current = false;
    };
    const onDbl = (e: MouseEvent) => {
      if (!reduced) {
        const accent = readVar("--accent", "#ff7a2f");
        const accent2 = readVar("--accent-2", "#3ddcc2");
        emitWave(e.clientX, e.clientY, ringSize * 3.8, accent);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          emitSpark(e.clientX, e.clientY, Math.cos(a) * 3, Math.sin(a) * 3, accent, accent2);
        }
      }
    };
    const onLeave = () => setVisible(false);
    const onScroll = () => {
      hoverRect.current = null;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("dblclick", onDbl);
    window.addEventListener("scroll", onScroll, true);
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("dblclick", onDbl);
      window.removeEventListener("scroll", onScroll, true);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, [enabled, trailOn, ribbonOn, chargeOn, reduced, glowOn, ringSize]);

  if (!enabled) return null;

  const half = ringSize / 2;
  const bHalf = half + 14;
  const gold = level >= 10;

  return (
    <>
      <canvas ref={canvasRef} className="cursor-canvas" />

      {/* сборка кольца */}
      <div
        ref={ringRef}
        className="pointer-events-none fixed left-0 top-0 z-[999] will-change-transform"
        style={{ opacity: visible ? 1 : 0, transition: "opacity .3s ease" }}
      >
        <div
          ref={glowRef}
          className="cursor-glow absolute rounded-full"
          style={{
            width: ringSize * 3.6,
            height: ringSize * 3.6,
            left: -ringSize * 1.8,
            top: -ringSize * 1.8,
            background: gold
              ? `radial-gradient(circle, ${GOLD}40 0%, ${GOLD}18 42%, transparent 68%)`
              : "radial-gradient(circle, color-mix(in srgb, var(--accent) 32%, transparent) 0%, color-mix(in srgb, var(--accent-2) 14%, transparent) 42%, transparent 68%)",
            transition: "opacity .35s ease",
          }}
        />

        {/* внешняя дуга */}
        <div
          ref={arcRef}
          className="absolute"
          style={{ left: -half - 6, top: -half - 6, width: ringSize + 12, height: ringSize + 12, transition: "opacity .18s ease" }}
        >
          <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="46" stroke={gold ? GOLD : "var(--accent)"} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="42 24 12 24 62 180" opacity="0.95" />
            <circle cx="50" cy="50" r="46" stroke="var(--accent-2)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="10 278" strokeDashoffset="-130" opacity="0.85" />
            <circle cx="50" cy="4" r="2.2" fill={gold ? GOLD : "var(--accent)"} />
          </svg>
        </div>

        {/* встречная внутренняя дуга */}
        <div
          ref={arc2Ref}
          className="absolute"
          style={{ left: -half - 6, top: -half - 6, width: ringSize + 12, height: ringSize + 12, transition: "opacity .18s ease", opacity: 0.6 }}
        >
          <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="31" stroke="var(--accent-2)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="5 13" opacity="0.7" />
            <circle cx="50" cy="19" r="1.8" fill="var(--accent-2)" />
          </svg>
        </div>

        {/* дуга энерго-заряда */}
        <div
          ref={chargeWrapRef}
          className="absolute"
          style={{ left: -half - 12, top: -half - 12, width: ringSize + 24, height: ringSize + 24, transform: "rotate(-90deg)", transition: "opacity .3s ease", opacity: 0 }}
        >
          <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="40" stroke="color-mix(in srgb, var(--tx) 14%, transparent)" strokeWidth="2" />
            <circle
              ref={chargeRef}
              cx="50"
              cy="50"
              r="40"
              stroke="var(--accent)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC}
              style={{ transition: "stroke .3s ease", filter: `drop-shadow(0 0 4px ${gold ? GOLD : "var(--accent)"})` }}
            />
          </svg>
        </div>

        {/* прицельные уголки */}
        <div
          ref={bracketsRef}
          className="absolute"
          style={{ left: -bHalf, top: -bHalf, width: bHalf * 2, height: bHalf * 2, opacity: 0, transition: "opacity .18s ease, transform .25s ease" }}
        >
          {(
            [
              { pos: "top left", v: "top", h: "left" },
              { pos: "top right", v: "top", h: "right" },
              { pos: "bottom left", v: "bottom", h: "left" },
              { pos: "bottom right", v: "bottom", h: "right" },
            ] as const
          ).map((c) => (
            <span
              key={c.pos}
              className="absolute h-[11px] w-[11px]"
              style={{
                left: c.h === "left" ? 0 : undefined,
                right: c.h === "right" ? 0 : undefined,
                top: c.v === "top" ? 0 : undefined,
                bottom: c.v === "bottom" ? 0 : undefined,
                borderStyle: "solid",
                borderWidth: 0,
                [`border${c.v === "top" ? "Top" : "Bottom"}Width`]: 2,
                [`border${c.h === "left" ? "Left" : "Right"}Width`]: 2,
                borderColor: "var(--accent-2)",
                filter: "drop-shadow(0 0 4px color-mix(in srgb, var(--accent-2) 70%, transparent))",
              }}
            />
          ))}
        </div>

        {/* кольцо */}
        <div
          ref={coreRef}
          className="absolute rounded-full border-[1.5px] transition-[opacity,border-color] duration-200"
          style={{
            width: ringSize,
            height: ringSize,
            left: -half,
            top: -half,
            borderColor: "color-mix(in srgb, var(--tx) 65%, transparent)",
            background: `color-mix(in srgb, ${gold ? GOLD : "var(--accent)"} 7%, transparent)`,
            boxShadow: "inset 0 0 16px color-mix(in srgb, var(--accent) 20%, transparent)",
          }}
        />

        {/* запрет */}
        <div
          ref={slashRef}
          className="absolute rounded-full"
          style={{
            width: ringSize * 1.25,
            height: 2,
            left: -ringSize * 0.625,
            top: -1,
            background: "var(--danger)",
            boxShadow: "0 0 10px var(--danger)",
            transform: "rotate(-45deg)",
            opacity: 0,
            transition: "opacity .15s ease",
          }}
        />

        {/* балка ввода */}
        <div
          ref={beamRef}
          className="beam-blink absolute rounded-full"
          style={{
            width: 3,
            height: ringSize * 0.95,
            left: -1.5,
            top: -ringSize * 0.475,
            background: "var(--accent)",
            boxShadow: "0 0 14px var(--accent)",
            opacity: 0,
            transition: "opacity .15s ease",
          }}
        />

        {/* тег игрока */}
        {tagOn && (
          <div
            className="font-mono2 absolute select-none whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[8.5px] font-extrabold tracking-[0.16em]"
            style={{
              left: half + 9,
              top: half + 7,
              color: gold ? GOLD : "var(--accent)",
              borderColor: gold ? `${GOLD}66` : "color-mix(in srgb, var(--accent) 42%, transparent)",
              background: "color-mix(in srgb, var(--bg0) 80%, transparent)",
              boxShadow: gold ? `0 0 14px ${GOLD}55` : "0 4px 14px rgba(0,0,0,0.45)",
              opacity: 0.92,
            }}
          >
            АЛЬФА
          </div>
        )}
      </div>

      {/* точка */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-[999] will-change-transform"
        style={{ opacity: visible ? 1 : 0, transition: "opacity .3s ease" }}
      >
        <div
          ref={dotCoreRef}
          className="rounded-full"
          style={{
            width: 7,
            height: 7,
            marginLeft: -3.5,
            marginTop: -3.5,
            background: gold ? GOLD : "var(--accent)",
            boxShadow: `0 0 12px ${gold ? GOLD : "var(--accent)"}, 0 0 28px color-mix(in srgb, ${gold ? GOLD : "var(--accent)"} 65%, transparent)`,
            transition: "opacity .15s ease, background .15s ease",
          }}
        />
      </div>
    </>
  );
}

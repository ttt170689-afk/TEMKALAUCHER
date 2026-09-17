import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { pointer } from "../lib/pointer";

interface Bit {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rot: number;
  c: string;
  w: number;
  h: number;
  delay: number;
  round: boolean;
}

/* Залп конфетти при повышении уровня */
export default function ConfettiFx() {
  const [bits, setBits] = useState<Bit[]>([]);

  useEffect(() => {
    let n = 0;
    const on = () => {
      const base = ++n * 100000 + Date.now();
      const colors = ["var(--accent)", "var(--accent-2)", "#ffd76a", "#ffffff"];
      const burst: Bit[] = [];
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 110 + Math.random() * 280;
        burst.push({
          id: base + i,
          x: pointer.x,
          y: pointer.y,
          dx: Math.cos(a) * dist,
          dy: Math.sin(a) * dist - 90,
          rot: Math.random() * 900 - 450,
          c: colors[i % colors.length],
          w: 4 + Math.random() * 6,
          h: 5 + Math.random() * 9,
          delay: Math.random() * 0.12,
          round: Math.random() > 0.7,
        });
      }
      setBits((p) => [...p, ...burst]);
      window.setTimeout(() => setBits((p) => p.filter((b) => b.id < base || b.id >= base + 64)), 1800);
    };
    window.addEventListener("temka-levelup", on);
    return () => window.removeEventListener("temka-levelup", on);
  }, []);

  return (
    <>
      {bits.map((b) => (
        <span
          key={b.id}
          className="confetti-bit"
          style={
            {
              left: b.x,
              top: b.y,
              width: b.w,
              height: b.round ? b.w : b.h,
              background: b.c,
              borderRadius: b.round ? "50%" : 2,
              boxShadow: `0 0 8px ${b.c}`,
              animationDelay: `${b.delay}s`,
              "--dx": `${b.dx}px`,
              "--dy": `${b.dy}px`,
              "--rot": `${b.rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

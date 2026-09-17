/* Крошечный WebAudio-синтезатор для звуков интерфейса — без внешних файлов */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  } catch {
    /* noop */
  }
}

export const sfx = {
  click: () => tone(1800, 0.05, "triangle", 0.045, 0, 1300),
  /* щелчок механической клавиатуры: шумовой клик + низкий «ток» */
  key: () => {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    try {
      const dur = 0.04 + Math.random() * 0.02;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
      const src = c.createBufferSource();
      src.buffer = buf;
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1700 + Math.random() * 1800;
      bp.Q.value = 0.9;
      const g = c.createGain();
      g.gain.value = 0.1 + Math.random() * 0.05;
      src.connect(bp);
      bp.connect(g);
      g.connect(c.destination);
      src.start();
    } catch {
      /* noop */
    }
    tone(150 + Math.random() * 70, 0.05, "sine", 0.05, 0, 85);
  },
  nav: () => {
    tone(300, 0.1, "sine", 0.05, 0, 620);
    tone(660, 0.08, "sine", 0.03, 0.06);
  },
  xp: () => tone(1180, 0.1, "sine", 0.05, 0, 1720),
  level: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.13, "triangle", 0.055, i * 0.09));
  },
  boot: () => {
    tone(180, 0.5, "sine", 0.045, 0, 760);
    tone(760, 0.16, "sine", 0.03, 0.42);
  },
  deny: () => tone(220, 0.14, "sawtooth", 0.04, 0, 110),
};

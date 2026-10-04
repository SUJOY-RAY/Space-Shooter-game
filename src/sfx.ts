// Tiny synthesized SFX engine for Space Shooter (Web Audio, zero assets).
// The context unlocks on the first user gesture (autoplay policy); M
// toggles mute, persisted across sessions.

const MUTE_KEY = "ss.muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function isMuted(): boolean {
    try {
        return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
        return false;
    }
}

let muted = isMuted();

function ac(): AudioContext | null {
    try {
        if (!ctx) {
            const AC =
                window.AudioContext ??
                (window as unknown as { webkitAudioContext?: typeof AudioContext })
                    .webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = 0.16;
            master.connect(ctx.destination);
        }
        if (ctx.state === "suspended") void ctx.resume();
        return ctx;
    } catch {
        return null;
    }
}

/** Per-sound rate limits so 60fps volleys can't stack oscillators — while
    simultaneous distinct sounds (left + right guns, kill during fire) still
    all come through. */
const lastByKey = new Map<string, number>();
function gate(key: string, minGapMs: number): boolean {
    const now = performance.now();
    if (now - (lastByKey.get(key) ?? 0) < minGapMs) return false;
    lastByKey.set(key, now);
    return true;
}

function tone(
    freq: number,
    dur: number,
    type: OscillatorType = "square",
    vol = 1,
    slideTo?: number,
    delay = 0,
    pan = 0
): void {
    if (muted) return;
    const c = ac();
    if (!c || !master) return;
    try {
        const t0 = c.currentTime + delay;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(20, freq), t0);
        if (slideTo !== undefined) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
        }
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(g);
        if (pan !== 0 && typeof c.createStereoPanner === "function") {
            const p = c.createStereoPanner();
            p.pan.value = Math.max(-1, Math.min(1, pan));
            g.connect(p);
            p.connect(master);
        } else {
            g.connect(master);
        }
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
    } catch {
        /* audio is best-effort */
    }
}

function noise(dur: number, vol = 1, delay = 0): void {
    if (muted) return;
    const c = ac();
    if (!c || !master) return;
    try {
        const t0 = c.currentTime + delay;
        const len = Math.max(1, Math.floor(c.sampleRate * dur));
        const buf = c.createBuffer(1, len, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = c.createBufferSource();
        src.buffer = buf;
        const g = c.createGain();
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        const filter = c.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1200;
        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start(t0);
    } catch {
        /* audio is best-effort */
    }
}

export const sfx = {
    get muted(): boolean {
        return muted;
    },
    toggle(): boolean {
        muted = !muted;
        try {
            localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
        } catch {
            /* ignore */
        }
        return muted;
    },
    /** Player main cannon. */
    shoot(): void {
        if (!gate("shoot", 30)) return;
        tone(880, 0.07, "square", 0.5, 440);
    },
    /** Wing guns (triple spread — both sides at once). */
    side(): void {
        if (!gate("side", 30)) return;
        tone(520, 0.08, "sawtooth", 0.4, 260);
    },
    /** Left wing gun — low blip, panned left. */
    fireLeft(): void {
        if (!gate("left", 30)) return;
        tone(440, 0.08, "square", 0.45, 220, 0, -0.6);
    },
    /** Right wing gun — higher blip, panned right. */
    fireRight(): void {
        if (!gate("right", 30)) return;
        tone(560, 0.08, "square", 0.45, 280, 0, 0.6);
    },
    /** Up-left diagonal — up pitch bent left. */
    fireUpLeft(): void {
        if (!gate("upleft", 30)) return;
        tone(700, 0.09, "sawtooth", 0.4, 350, 0, -0.35);
    },
    /** Up-right diagonal — up pitch bent right. */
    fireUpRight(): void {
        if (!gate("upright", 30)) return;
        tone(760, 0.09, "sawtooth", 0.4, 380, 0, 0.35);
    },
    /** Enemy volley (kept quiet — they shoot a lot). */
    zap(): void {
        if (!gate("zap", 90)) return;
        tone(300, 0.08, "sawtooth", 0.25, 180);
    },
    /** Enemy destroyed. */
    boom(): void {
        if (!gate("boom", 40)) return;
        noise(0.25, 0.9);
        tone(150, 0.2, "triangle", 0.7, 40);
    },
    /** Player takes a hit. */
    hit(): void {
        tone(220, 0.2, "sawtooth", 0.8, 90);
        noise(0.12, 0.5);
    },
    /** Run start. */
    launch(): void {
        tone(220, 0.25, "square", 0.5, 880);
    },
    /** Game-over jingle. */
    over(): void {
        tone(392, 0.16, "triangle", 0.7);
        tone(311, 0.16, "triangle", 0.7, undefined, 0.16);
        tone(233, 0.32, "triangle", 0.7, undefined, 0.32);
    },
};

/** Unlock audio on first gesture + wire the M mute toggle. */
export function initSfx(): void {
    const unlock = (): void => {
        ac();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", (e) => {
        unlock();
        if (e.repeat) return;
        if (e.key.toLowerCase() === "m") sfx.toggle();
    });
}

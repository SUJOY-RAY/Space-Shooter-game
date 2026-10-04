// On-screen arcade pad for touch devices (old-handheld style: D-pad on the
// left, A/B cannons on the right, Start/Select pills in the middle).
// Buttons feed the shared keyboard state via setVirtualKey, so all existing
// chords keep working — e.g. holding A (x) with B (z+c) fires both diagonals.

import { isTouchDevice, setVirtualKey } from "./input.js";

export function initTouchControls(): void {
    const pad = document.getElementById("pad");
    if (!pad) return;
    const touch = isTouchDevice();
    document.body.classList.toggle("touch", touch);
    if (!touch) return;
    pad.hidden = false;
    pad.addEventListener("contextmenu", (e) => e.preventDefault());

    const buttons = pad.querySelectorAll<HTMLButtonElement>("button[data-keys]");
    for (const btn of buttons) {
        const codes = (btn.dataset.keys ?? "")
            .split("+")
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.length > 0);
        if (codes.length === 0) continue;
        const down = (e: PointerEvent): void => {
            e.preventDefault();
            for (const c of codes) setVirtualKey(c, true);
            btn.classList.add("active");
            try {
                btn.setPointerCapture(e.pointerId);
            } catch {
                /* older browsers: release handled by pointerup/cancel */
            }
        };
        const up = (e: PointerEvent): void => {
            e.preventDefault();
            for (const c of codes) setVirtualKey(c, false);
            btn.classList.remove("active");
        };
        btn.addEventListener("pointerdown", down);
        btn.addEventListener("pointerup", up);
        btn.addEventListener("pointercancel", up);
        btn.addEventListener("lostpointercapture", up);
        btn.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    initFireRing(pad);

    // Focus loss already clears keys (input.ts); just drop the visuals here.
    window.addEventListener("blur", () => {
        const actives = pad.querySelectorAll(".active");
        for (const b of actives) b.classList.remove("active");
        pad.querySelector("#fire-ring")?.classList.remove("active");
    });
}

// Fire joystick: draggable ball-top stick. The stick follows the thumb
// (clamped inside the dish) and the shot follows the stick angle, so
// diagonals land properly. Center is neutral — release springs back
// and stops the guns. Sectors map onto the real gun combos.
const FIRE_SECTORS: string[][] = [
    ["x"],           // N — up
    ["x", "c"],      // NE — up-right diagonal
    ["c"],           // E — right
    ["c"],           // SE — nearest supported: right
    ["z", "x", "c"], // S — triple spread (both diagonals)
    ["z"],           // SW — nearest supported: left
    ["z"],           // W — left
    ["z", "x"],      // NW — up-left diagonal
];

function initFireRing(pad: HTMLElement): void {
    const ring = pad.querySelector<HTMLElement>("#fire-ring");
    const stick = pad.querySelector<HTMLElement>("#fire-ring .joy-stick");
    if (!ring || !stick) return;
    let pressed = false;
    let held: string[] = [];

    const setSector = (keys: string[]): void => {
        for (const k of held) if (!keys.includes(k)) setVirtualKey(k, false);
        for (const k of keys) if (!held.includes(k)) setVirtualKey(k, true);
        held = [...keys];
    };
    const parkStick = (): void => {
        ring.style.setProperty("--jx", "0px");
        ring.style.setProperty("--jy", "0px");
        ring.style.setProperty("--mag", "0px");
    };
    const release = (): void => {
        for (const k of held) setVirtualKey(k, false);
        held = [];
        pressed = false;
        ring.classList.remove("active");
        parkStick();
    };
    const drag = (clientX: number, clientY: number): void => {
        const r = ring.getBoundingClientRect();
        const R = r.width / 2;
        // Keep the whole ball inside the dish.
        const max = Math.max(8, R - stick.offsetWidth / 2 - 2);
        let dx = clientX - (r.left + R);
        let dy = clientY - (r.top + R);
        const len = Math.hypot(dx, dy);
        if (len > max) {
            dx = (dx / len) * max;
            dy = (dy / len) * max;
        }
        const mag = Math.hypot(dx, dy);
        ring.style.setProperty("--jx", `${dx.toFixed(1)}px`);
        ring.style.setProperty("--jy", `${dy.toFixed(1)}px`);
        ring.style.setProperty("--mag", `${mag.toFixed(1)}px`);
        // Neutral middle: guns stay silent until the stick leaves it.
        if (mag < R * 0.15) {
            setSector([]);
            return;
        }
        // 0deg = E … index 0 = N, then clockwise every 45deg.
        const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        ring.style.setProperty("--aim", `${deg.toFixed(1)}deg`);
        const idx = Math.round((((deg + 90) % 360) + 360) % 360 / 45) % 8;
        setSector(FIRE_SECTORS[idx]!);
    };

    ring.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        pressed = true;
        ring.classList.add("active");
        try {
            ring.setPointerCapture(e.pointerId);
        } catch {
            /* older browsers: release handled by pointerup/cancel */
        }
        drag(e.clientX, e.clientY);
    });
    ring.addEventListener("pointermove", (e) => {
        if (!pressed) return;
        e.preventDefault();
        drag(e.clientX, e.clientY);
    });
    ring.addEventListener("pointerup", (e) => {
        e.preventDefault();
        release();
    });
    ring.addEventListener("pointercancel", release);
    ring.addEventListener("lostpointercapture", release);
    ring.addEventListener("contextmenu", (e) => e.preventDefault());
    // Keyboard fallback when the stick has focus: hold to fire up.
    ring.addEventListener("keydown", (e) => {
        if (e.repeat) return;
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pressed = true;
            ring.classList.add("active");
            const R = ring.getBoundingClientRect().width / 2;
            const up = Math.max(8, R - stick.offsetWidth / 2 - 2);
            ring.style.setProperty("--jx", "0px");
            ring.style.setProperty("--jy", `${(-up).toFixed(1)}px`);
            ring.style.setProperty("--mag", `${up.toFixed(1)}px`);
            ring.style.setProperty("--aim", "-90deg");
            setSector(["x"]);
        }
    });
    ring.addEventListener("keyup", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            release();
        }
    });
    ring.addEventListener("blur", release);
}

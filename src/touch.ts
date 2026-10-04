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

    // Focus loss already clears keys (input.ts); just drop the visuals here.
    window.addEventListener("blur", () => {
        const actives = pad.querySelectorAll(".active");
        for (const b of actives) b.classList.remove("active");
    });
}

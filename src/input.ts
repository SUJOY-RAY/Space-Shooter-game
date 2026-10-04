const keys = new Set<string>();

// Game keys that must never scroll the page (small iframe window or tab).
const SCROLL_KEYS = new Set([
    " ",
    "spacebar",
    "arrowup",
    "arrowdown",
    "arrowleft",
    "arrowright",
]);

export function initInput(): void {
    window.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        keys.add(k);
        // Kill the browser's default scroll so the screen stays still while playing.
        if (SCROLL_KEYS.has(k)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
        keys.delete(e.key.toLowerCase());
    });
    // If focus is lost (e.g. clicking outside), drop held keys so the ship stops.
    window.addEventListener("blur", () => keys.clear());
}

export function isDown(...codes: string[]): boolean {
    return codes.some((c) => keys.has(c));
}

export function wasPressed(k: string): boolean {
    return keys.has(k);
}

// ---------- on-screen arcade pad (touch) ----------

/** Drive the same key set from touch buttons (D-pad, A/B, Start). */
export function setVirtualKey(code: string, down: boolean): void {
    const k = code.toLowerCase();
    if (down) keys.add(k);
    else keys.delete(k);
}

/** True on touch-first devices (coarse pointer). Hybrids keep keyboard UI. */
export function isTouchDevice(): boolean {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    if (typeof window.matchMedia === "function") {
        return window.matchMedia("(pointer: coarse)").matches;
    }
    return "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
}
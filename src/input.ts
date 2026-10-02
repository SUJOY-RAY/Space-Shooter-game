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
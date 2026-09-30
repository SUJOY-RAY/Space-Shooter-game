const keys = new Set<string>();

export function initInput(): void {
    window.addEventListener("keydown", (e) => {
        keys.add(e.key.toLowerCase());
        if (e.key === "") e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
        keys.delete(e.key.toLowerCase());
        if (e.key == "") e.preventDefault();
    });
}

export function isDown(...codes: string[]): boolean {
    return codes.some((c) => keys.has(c));
}

export function wasPressed(k: string): boolean {
    return keys.has(k);
}
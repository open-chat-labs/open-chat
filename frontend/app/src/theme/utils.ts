export function hexPercent(hex: string, alpha: number | undefined): string {
    const r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    if (alpha !== undefined) {
        return `rgba(${r}, ${g}, ${b}, ${alpha / 100})`;
    } else {
        return `rgb(${r}, ${g}, ${b})`;
    }
}

export function darkenHexColour(hex: string, percent: number) {
    hex = hex.replace(/^#/, "");

    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent / 100))));
    g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent / 100))));
    b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent / 100))));

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

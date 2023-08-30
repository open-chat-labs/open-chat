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

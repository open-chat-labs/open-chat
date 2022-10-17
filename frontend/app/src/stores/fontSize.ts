import { writable } from "svelte/store";
import { configKeys } from "../utils/config";

export type FontScale = 0 | 1 | 2 | 3 | 4;

export const fontSizeScale = writable<FontScale>(getCurrentFontSize());

function translateScale(scale: FontScale): string {
    if (scale === 0) return "12px";
    if (scale === 1) return "14px";
    if (scale === 2) return "16px";
    if (scale === 3) return "18px";
    if (scale === 4) return "20px";
    throw new Error("Unexpected font scale value");
}

export function getCurrentFontSize(): FontScale {
    const size = Number(localStorage.getItem(configKeys.fontSize) ?? "2") as FontScale;
    document.documentElement.style.setProperty("--font-size", translateScale(size));
    return size;
}

export function setFontSize(scale: FontScale): void {
    fontSizeScale.set(scale);
    localStorage.setItem(configKeys.fontSize, scale.toString());
    document.documentElement.style.setProperty("--font-size", translateScale(scale));
}

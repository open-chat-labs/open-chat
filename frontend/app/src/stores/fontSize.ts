import { derived, writable } from "svelte/store";
import { configKeys } from "../utils/config";
import { dimensions } from "./screenDimensions";

export type FontScale = 0 | 1 | 2 | 3 | 4;

export const fontSizeScale = writable<FontScale>(getCurrentFontScale());

function translateScale(scale: FontScale): number {
    if (scale === 0) return 0.75;
    if (scale === 1) return 0.875;
    if (scale === 2) return 1;
    if (scale === 3) return 1.125;
    if (scale === 4) return 1.25;
    throw new Error("Unexpected font scale value");
}

export function getCurrentFontScale(): FontScale {
    return Number(localStorage.getItem(configKeys.fontSize) ?? "2") as FontScale;
}

export function setFontScale(scale: FontScale): void {
    fontSizeScale.set(scale);
    localStorage.setItem(configKeys.fontSize, scale.toString());
}

function setFontSize(size: number): void {
    document.documentElement.style.setProperty("--font-size", `${size}px`);
}

// we're just going to keep this *really* simple for now and have two basic font root sizes
// Note: if you change this you must also change pixelsFromRems
function baseFontSizeForScreenWidth(width: number): number {
    if (width < 768) {
        return 14;
    } else {
        return 16;
    }
}

const adjustedFontSize = derived([fontSizeScale, dimensions], ([$scale, $dimensions]) => {
    const px = baseFontSizeForScreenWidth($dimensions.width);
    const adjusted = px * translateScale($scale);
    setFontSize(adjusted);
    return adjusted;
});

adjustedFontSize.subscribe((size) => {
    console.log("Setting root font size to: ", size);
});

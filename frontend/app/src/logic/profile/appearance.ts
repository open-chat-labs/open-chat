import type { FontScale } from "@client";

// The appearance settings the new profile dialog offers, onto the app's: four font sizes for the
// five steps of fontScaleStore (0.75 to 1.25). The sizes are steps 1 to 4; a stored 0 shows as the
// smallest and stays as it is until another size is picked, so no one's scale moves on its own.

export type FontSize = "small" | "default" | "large" | "larger";

const SCALES: Record<FontSize, FontScale> = { small: 1, default: 2, large: 3, larger: 4 };

export function isFontSize(name: string): name is FontSize {
    return Object.hasOwn(SCALES, name);
}

export function fontSizeOf(scale: FontScale): FontSize {
    switch (scale) {
        case 0:
        case 1:
            return "small";
        case 2:
            return "default";
        case 3:
            return "large";
        case 4:
            return "larger";
    }
}

/** The scale to store for a size picked, given the one stored. */
export function fontScaleFor(size: FontSize, stored: FontScale): FontScale {
    return fontSizeOf(stored) === size ? stored : SCALES[size];
}

import { fontScaleFactor, type FontScale } from "@client";

// The appearance settings the new trees offer (the web's profile, the native Welcome's menu and
// You → Appearance), onto the app's stored ones, so each shows the same: the theme (themeType,
// which may hold a theme name the design doesn't have), and four font sizes for the five steps of
// fontScaleStore (0.75 to 1.25). The sizes are steps 1 to 4; a stored 0 shows as the smallest and
// stays as it is until another size is picked, so no one's scale moves on its own.

export type ThemePref = "light" | "dark" | "system";

/** The theme choices, in the design's order. */
export const THEME_PREFS: readonly ThemePref[] = ["light", "dark", "system"];

/** The theme a stored themeType shows as: one the design doesn't have shows as the system's. */
export function themePrefOf(stored: string): ThemePref {
    return stored === "dark" || stored === "light" ? stored : "system";
}

export type FontSize = "small" | "default" | "large" | "larger";

/** The font sizes, smallest first. */
export const FONT_SIZES: readonly FontSize[] = ["small", "default", "large", "larger"];

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

// The native tree's text scale: tokens.css's --text-scale, which the --text-* sizes follow. The native app sets it
// on <html>, so it reaches what's portalled to <body> as well (the call screen).
// It's the font size setting's factor times the platform's own font scale (dynamic type on iOS, the font scale
// on Android, 1 on mobile web), kept between TEXT_SCALE_MIN and TEXT_SCALE_MAX so screens stay usable at the
// extremes, and rounded to 3 places so the style it's written to only changes when the scale does.

export const TEXT_SCALE_MIN = 0.75;
export const TEXT_SCALE_MAX = 2;

/** The native text scale for a stored font size setting and the platform's font scale (1 = the system default). */
export function textScaleOf(stored: FontScale, platformScale: number): number {
    const platform = Number.isFinite(platformScale) && platformScale > 0 ? platformScale : 1;
    const scale = Math.min(
        TEXT_SCALE_MAX,
        Math.max(TEXT_SCALE_MIN, fontScaleFactor(stored) * platform),
    );
    return Math.round(scale * 1000) / 1000;
}

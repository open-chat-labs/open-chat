import { configKeys } from "@shared";
import { theme as neon } from "component-lib";
import { activeThemeV2Id, initThemeV2 } from "./themeV2";
import { derived, readable, writable } from "svelte/store";
import { createLocalStorageStore } from "../utils/store";
import { getTheme as getBarbieTheme } from "./community/barbie";
import { getTheme as getBlueTheme } from "./community/blue";
import { getTheme as getHalloweenTheme } from "./community/halloween";
import { getTheme as getMatteBlackGoldTheme } from "./community/matteblackgold";
import { getLightTheme as getNeonLightTheme, getTheme as getNeonTheme } from "./community/neon";
import { getTheme as getNightvisionTheme } from "./community/nightvision";
import { getTheme as getSignalsTheme } from "./community/signals";
import { getTheme as getSolarizedDarkTheme } from "./community/solarizeddark";
import { getTheme as getSubmarineTheme } from "./community/submarine";
import { getTheme as getTokyoNightTheme } from "./community/tokyonight";
import { getTheme as getWindoge98Theme } from "./community/windoge98";
import { darkTheme } from "./defaultDark";
import { getTheme as getWhiteTheme } from "./defaultLight";
import { deepMerge } from "./merge";
import type { Theme, Themes } from "./types";

const blueTheme = getBlueTheme();
const defaultLight = getWhiteTheme(cloneTheme(blueTheme));
const defaultDark = darkTheme(blueTheme);

// Community themes need to be added here
export const communityThemes = [
    blueTheme,
    getSubmarineTheme(cloneTheme(defaultDark)),
    getNightvisionTheme(cloneTheme(defaultDark)),
    getMatteBlackGoldTheme(cloneTheme(defaultDark)),
    getBarbieTheme(cloneTheme(blueTheme)),
    getTokyoNightTheme(cloneTheme(defaultDark)),
    getWindoge98Theme(cloneTheme(blueTheme)),
    getSolarizedDarkTheme(cloneTheme(defaultDark)),
    getHalloweenTheme(cloneTheme(defaultDark)),
    getSignalsTheme(cloneTheme(blueTheme)),
];

if (import.meta.env.OC_MOBILE_LAYOUT === "v2") {
    communityThemes.push(getNeonTheme(cloneTheme(defaultDark)));
    communityThemes.push(getNeonLightTheme(cloneTheme(defaultLight)));
}

export const themes: Themes = {
    white: defaultLight,
    dark: defaultDark,
};

communityThemes.forEach((theme) => {
    themes[theme.name] = theme;
});

function cloneTheme(theme: Theme): Theme {
    return JSON.parse(JSON.stringify(theme));
}

function writeCssVars(prefix: string, section: Theme): void {
    for (const [comp, props] of Object.entries(section)) {
        if (typeof props === "string") {
            const varStr = `${prefix}${comp}`;
            document.documentElement.style.setProperty(varStr, props);
        } else if (typeof props === "object" && props) {
            writeCssVars(`${prefix}${comp}-`, props);
        }
    }
}

const prefersDarkQuery = "(prefers-color-scheme: dark)";

const osDarkStore = readable(window.matchMedia(prefersDarkQuery).matches, (set) => {
    const updateDarkPref = (event: MediaQueryListEvent) => set(event.matches);
    const mediaQueryList = window.matchMedia(prefersDarkQuery);
    mediaQueryList.addEventListener("change", updateDarkPref);
    set(mediaQueryList.matches);
    return () => mediaQueryList.removeEventListener("change", updateDarkPref);
});

export function setModifiedTheme(
    baseName: string,
    newName: string,
    overrides: Partial<Theme>,
): void {
    const base = themes[newName] ?? themes[baseName];
    if (base) {
        const overridden = deepMerge(base, overrides);
        themes[newName] = overridden;
        themeOverride.set(newName);
    }
}

export function writeNativeCssVariables() {
    neon.writeCssVariables();
}

export function setNativeTheme() {
    initThemeV2();
    // Keep the v1-derived css variables (still used in places by the v2
    // layout) in step with the selected v2 mode.
    activeThemeV2Id.subscribe((id) => {
        const light = id.endsWith("-light");
        themeOverride.set(light ? "neon_light" : "neon_dark");
        rememberThemeMode(light ? "light" : "dark");
    });
}

// The next page load paints a dark background straight from index.html if the theme was a dark
// one (`generateStartupScript` in rollup.extras.mjs), rather than staying white until the app's
// styles have arrived.
const STARTUP_THEME_MODE_KEY = "openchat_startup_theme_mode";

function rememberThemeMode(mode: Theme["mode"]): void {
    try {
        localStorage.setItem(STARTUP_THEME_MODE_KEY, mode);
    } catch {
        // without storage the next load goes by the OS preference
    }
}

// Once the app has drawn its own background the one painted by index.html has done its job.
// Left in place it would sit behind the body's, and show a stale colour wherever the body
// doesn't reach after a change of theme.
export function clearStartupBackground(): void {
    // the body fades its background in over 300ms, so give that time to finish first
    window.setTimeout(
        () => document.documentElement.style.removeProperty("background-color"),
        1000,
    );
}

export const themeOverride = writable<string>(undefined);
export const themeType = createLocalStorageStore(configKeys.theme, "system");
export const preferredDarkThemeName = createLocalStorageStore("openchat_dark_theme", "dark");
export const preferredLightThemeName = createLocalStorageStore("openchat_light_theme", "white");

// A stored name can outlive its theme, so one we don't have falls back to the default of its mode
// rather than leaving the app with no theme at all, which crashes it on every load (Rollbar #32044)
function darkThemeName(name: string): string {
    return themes[name] !== undefined ? name : "dark";
}

function lightThemeName(name: string): string {
    // we have renamed "light" to "blue"
    if (name === "light") name = "blue";
    return themes[name] !== undefined ? name : "white";
}

export const preferredDarkTheme = derived(
    preferredDarkThemeName,
    (darkName) => themes[darkThemeName(darkName)],
);
export const preferredLightTheme = derived(
    preferredLightThemeName,
    (lightName) => themes[lightThemeName(lightName)],
);

export const currentThemeName = derived(
    [themeType, preferredDarkThemeName, preferredLightThemeName, osDarkStore, themeOverride],
    ([$themeType, storedDark, storedLight, prefersDark, override]) => {
        if (override !== undefined) return override;

        const preferredDark = darkThemeName(storedDark);
        const preferredLight = lightThemeName(storedLight);

        let themeName = "white";
        if ($themeType === "system") {
            if (prefersDark) {
                themeName = preferredDark;
            } else {
                themeName = preferredLight;
            }
        } else if ($themeType === "light") {
            themeName = preferredLight;
        } else if ($themeType === "dark") {
            themeName = preferredDark;
        } else {
            // this branch exists to deal with legacy states where a user has selected a particular community theme
            const existing = themes[$themeType];
            if (existing !== undefined) {
                if (existing.mode === "dark") {
                    preferredDarkThemeName.set($themeType);
                    themeType.set("dark");
                }
                if (existing.mode === "light") {
                    preferredLightThemeName.set($themeType);
                    themeType.set("light");
                }
                themeName = $themeType;
            }
        }
        return themeName;
    },
);

function loadFont(theme: Theme): void {
    if (theme.fontUrl) {
        const link = document.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("type", "text/css");
        link.setAttribute("href", theme.fontUrl);
        document.getElementsByTagName("head")[0].appendChild(link);
    }
}

export const currentTheme = derived(currentThemeName, (name) => {
    const theme = themes[name];
    loadFont(theme);
    writeCssVars("--", theme);
    rememberThemeMode(theme.mode);
    return theme;
});

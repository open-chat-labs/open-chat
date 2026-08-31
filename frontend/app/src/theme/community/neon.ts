import {
    colourHexMapToColours,
    neonDark,
    neonLight,
    type ThemeColourHexMap,
    type ThemeMode,
} from "component-lib";
import type { Theme } from "../types";

// Bridges a v2 (component-lib) colour map onto the v1 theme structure so that
// the v1 css variables still used in places by the mobile layout follow the
// selected v2 theme/mode.
function buildTheme(base: Theme, map: ThemeColourHexMap, name: string, mode: ThemeMode): Theme {
    const colours = colourHexMapToColours(map);
    const light = mode === "light";
    const primary = colours.primary.toString();
    const primarySurface = colours.primarySurface.toString();
    const secondary = colours.secondary.toString();
    const success = colours.validationSuccess.toString();
    const warning = colours.validationWarning.toString();
    const error = colours.validationError.toString();
    const buttonDisabled = colours.surfaceDisabled.toString();
    const level0 = colours.surface0.toString();
    const level1 = colours.surface1.toString();
    const txtOnPrimary = colours.textOnPrimary.toString();
    const txtPrimary = colours.textPrimary.toString();
    const txtSecondary = colours.textSecondary.toString();
    const inputBg = colours.inputBackground.toString();
    const txtPlaceholder = colours.inputPlaceholder.toString();
    const txtOnFeedback = colours.textOnFeedbackSurface.toString();

    // it's ok to mutate the theme passed in because it's a clone
    base.author = "2yfsq-kaaaa-aaaaf-aaa4q-cai";
    base.font = '"Manrope", sans-serif';
    base["font-bold"] = '"Manrope", sans-serif';
    base.mode = mode;
    base.name = name;
    base.label = "Neon";
    base.burst = false;
    base.primary = primary;
    base.accent = secondary;
    base.error = error;
    base.warn = warning;
    base.success = success;
    base.bg = level0;
    base.txt = txtPrimary;
    base["txt-light"] = txtSecondary;
    base.disabledTxt = txtSecondary;
    base.panel.bg = level0;
    base.panel.right.bg = level0;
    base.panel.left.bg = level0;
    base.panel.right.modal = level0;
    base.panel.nav.bg = level1;
    base.placeholder = txtPlaceholder;
    base.button.bg = primary;
    base.button.hv = primary;
    base.button.txt = txtOnPrimary;
    base.button["hv-txt"] = txtOnPrimary;
    base.button.disabled = buttonDisabled;
    base.button["disabled-txt"] = level0;
    base.button.spinner = primary;
    base.input.bg = inputBg;
    base.input.bd = "none";
    base.input.sh = "none";
    base.input.accent = secondary;
    base.chatSearch.bg = inputBg;
    base.toast.failure.bg = error;
    base.toast.failure.txt = txtOnFeedback;
    base.toast.success.bg = success;
    base.unread.bg = primary;
    base.unread.txt = txtOnPrimary;
    base.link.underline = secondary;
    base.button.hollow.bd = primary;
    base.button.hollow.txt = primary;
    base.button.secondary.bd = primarySurface;
    base.button.secondary["bd-hv"] = primary;
    base.button.secondary.txt = primarySurface;
    base.button.secondary["txt-hv"] = primary;
    base.modal.bg = level0;
    base.menu.bg = level1;
    base.menu.txt = txtPrimary;
    base.menu.sh = light
        ? "0px 4px 6px 0px rgba(0, 0, 0, 0.15)"
        : "0px 4px 6px 0px rgba(0, 0, 0, 0.3)";
    base.menu.bd = "none";
    base.menu.rd = "1rem";
    base.menu.warn = error;
    base.menu.separator = light ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)";
    base.icon.hv = txtOnPrimary;
    base.icon.txt = txtSecondary;
    base.icon.selected = primary;
    base.currentChat.msg.bg = level1;
    base.currentChat.msg.me.bg = primary;
    base.currentChat.msg.focus = primary;
    base.entry.bg = "none";
    base.entry.input.bg = base.input.bg;
    base.entry.input.sh = "none";

    base.chatSearch.bg = base.input.bg;
    base.chatSearch.sh = "none";

    return base;
}

export function getTheme(base: Theme): Theme {
    return buildTheme(base, neonDark, "neon_dark", "dark");
}

export function getLightTheme(base: Theme): Theme {
    return buildTheme(base, neonLight, "neon_light", "light");
}

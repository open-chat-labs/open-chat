import { theme as neon } from "component-lib";
import type { Theme } from "../types";

const primary = neon.colours.primary.toString();
const primaryMuted = neon.colours.primaryMuted.toString();
const secondary = neon.colours.secondary.toString();
const success = neon.colours.success.toString();
const warning = neon.colours.warning.toString();
const error = neon.colours.error.toString();
const buttonDisabled = neon.colours.disabledButton.toString();
const level0 = neon.colours.background0.toString();
const level1 = neon.colours.background1.toString();
const txtOnPrimary = neon.colours.textOnPrimary.toString();
const txtPrimary = neon.colours.textPrimary.toString();
const txtSecondary = neon.colours.textSecondary.toString();
const txtTertiary = neon.colours.textTertiary.toString();
const txtPlaceholder = neon.colours.textPlaceholder.toString();
const buttonGradient = neon.colours.gradientInverted.toString();

export function getTheme(base: Theme): Theme {
    // it's ok to mutate the theme passed in because it's a clone
    base.author = "2yfsq-kaaaa-aaaaf-aaa4q-cai";
    base.mode = "dark";
    base.name = "neon_dark";
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
    base.input.bg = txtTertiary;
    base.input.bd = "none";
    base.input.sh = "none";
    base.input.accent = secondary;
    base.chatSearch.bg = txtTertiary;
    base.toast.failure.bg = error;
    base.toast.failure.txt = txtPrimary;
    base.toast.success.bg = success;
    base.unread.bg = primary;
    base.unread.txt = txtOnPrimary;
    base.link.underline = secondary;
    base.button.hollow.bd = primary;
    base.button.hollow.txt = primary;
    base.button.secondary.bd = primaryMuted;
    base.button.secondary["bd-hv"] = primary;
    base.button.secondary.txt = primaryMuted;
    base.button.secondary["txt-hv"] = primary;
    base.modal.bg = level0;
    base.menu.bg = level1;
    base.menu.txt = txtPrimary;
    base.menu.sh = "0px 4px 6px 0px rgba(0, 0, 0, 0.3)";
    base.menu.bd = "none";
    base.menu.rd = "1rem";
    base.menu.warn = error;
    base.menu.separator = "rgba(255,255,255,0.1)";
    base.icon.hv = txtOnPrimary;
    base.icon.txt = txtSecondary;
    base.icon.selected = primary;
    base.currentChat.msg.bg = level1;
    base.currentChat.msg.me.bg = primary;
    base.currentChat.msg.focus = secondary;
    base.entry.bg = "none";
    base.entry.input.bg = base.input.bg;
    base.entry.input.sh = "none";

    // TODO - not convinced that Manrope for the default body text is good.
    // Works well for headers but not for default message text - roboto (the current default) feels better
    // base.font = '"Manrope", sans-serif';

    base.chatSearch.bg = base.input.bg;
    base.chatSearch.sh = "none";

    return base;
}

import type { Theme } from "../types";
import { hexPercent } from "../utils";

const mexicanPink = "#e41e79";
const celestialBlue = "#23a2ee";
const emerald = "#4dc164";
const orangeCrayola = "#f36d28";
const red = "#ea2929";
const raisinBlack = "#242834";
const gunmetal = "#2f333e";
const charcoal = "#3a3e48";
const gray = "#7c7e85";
const violet = "#4a2642";
const mardiGras = "#8d2380";
const darkGray = "#242834";

const primary = mexicanPink;
const primaryDimmed = hexPercent(primary, 70);
const primaryMuted = violet;
const secondary = celestialBlue;
const success = emerald;
const warning = orangeCrayola;
const error = red;
const buttonDisabled = gray;
const level0 = raisinBlack;
const level1 = gunmetal;
const level2 = charcoal;
const txtOnPrimary = darkGray;
const txtPrimary = "#ffffff";
const txtSecondary = "#9c9ea4";
const txtTertiary = "#50535d";
const txtPlaceholder = "#a7a9ae";

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
    base.button.bg = `linear-gradient(270deg, ${mardiGras} 0%, ${mexicanPink} 100%)`;
    base.button.hv = `linear-gradient(270deg, ${mardiGras} 0%, ${mexicanPink} 100%)`;
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
    base.button.secondary.bd = primaryDimmed;
    base.button.secondary["bd-hv"] = primary;
    base.button.secondary.txt = primaryDimmed;
    base.button.secondary["txt-hv"] = primary;
    base.modal.bg = level0;
    base.menu.bg = level1;
    base.menu.txt = txtPrimary;
    base.menu.sh = "0px 4px 6px 0px rgba(0, 0, 0, 0.3)";
    base.menu.bd = "none";
    base.menu.rd = "1rem";
    base.menu.warn = error;
    (base.menu.separator = "rgba(255,255,255,0.1)"), (base.icon.hv = darkGray);
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

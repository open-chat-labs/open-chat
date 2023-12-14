import type { Theme } from "../types";
import { hexPercent } from "../utils";

// const orange = "#fc8e0f";
const red = "#b41f2a";
// const darkOrange = "#f3722b";
const darkRed = "#881820";
const lightGreen = "#3abd8f";
const green = "#226f54";
const cream = "#f4f0bb";
const grey = "#fbfaf4";
const darkBrown = "#20140f";
const lighterBrown = "#432a1f";

const txt = grey;
const txtLight = hexPercent(cream, 80);

export function getTheme(base: Theme): Theme {
    base.author = "2yfsq-kaaaa-aaaaf-aaa4q-cai";
    base.name = "xmasdark";
    base.label = "Christmas";
    base.burst = false;
    base.bd = hexPercent(red, 30);
    base.bg =
        "linear-gradient(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.5)), url('/assets/xmas_dark.png') center/cover no-repeat";
    base.scrollbar.bg = hexPercent(red, 30);
    base.txt = txt;
    base["txt-light"] = txtLight;
    base.accent = green;
    base.code = green;
    base["font-bold"] = `'Berkshire Swash', ${base["font-bold"]}`;
    base.font = `'Berkshire Swash', ${base.font}`;
    base.fontUrl = "https://fonts.googleapis.com/css2?family=Berkshire+Swash&display=swap";

    base.icon.txt = cream;
    base.icon.selected = lightGreen;
    base.button.bg = red;
    base.button.hv = darkRed;
    base.button.txt = txt;
    base.button.disabled = lighterBrown;
    base.button["disabled-txt"] = hexPercent(darkRed, 90);

    base.collapsible.closed.header.txt = txt;
    base.collapsible.open.header.arrow = lightGreen;

    base.panel.nav.bg = hexPercent(darkBrown, 80);
    base.panel.left.bg = hexPercent(darkBrown, 80);
    base.panel.right.modal = darkBrown;
    base.panel.right.bg = hexPercent(darkBrown, 80);
    base.modal.bd = base.bd;
    base.modal.bg = darkBrown;
    base.recommended.bg = hexPercent(darkBrown, 80);

    base.currentChat.msg.bg = darkBrown;
    // base.currentChat.msg.bd = `1px solid ${hexPercent(cream, 50)}`;
    base.currentChat.msg.me.bg = darkRed;
    base.currentChat.msg.txt = txt;
    base.currentChat.date.bg = base.currentChat.msg.bg;
    base.currentChat.msg.inert = base.currentChat.msg.bg;

    base.chatSummary["bg-selected"] = lighterBrown;
    base.chatSummary.hv = hexPercent(lighterBrown, 80);
    base.chatSummary.del = base.button.bg;
    base.members.hv = darkBrown;
    base.placeholder = txtLight;
    base.entry.input.bg = lighterBrown;
    base.entry.bg = hexPercent(darkBrown, 80);
    base.entry.input.sh = `inset 0px 2px 4px rgba(0,0,0,0.8)`;
    base.input.bg = lighterBrown;
    base.input.sh = `inset 0px 2px 4px rgba(0,0,0,0.8)`;
    base.input.accent = lightGreen;
    base.chatSearch.bg = darkBrown;
    base.chatSearch.sh = `inset 0px 2px 4px rgba(0,0,0,0.8)`;
    base.notificationBar.bg = green;
    base.notificationBar.txt = txt;
    base.timeline.txt = base.notificationBar.txt;

    base.menu.bd = base.bd;
    base.menu.bg = base.panel.right.modal;
    base.menu.txt = txt;
    base.menu.warn = txt;
    base.menu["disabled-txt"] = txtLight;
    base.icon.inverted.txt = txt;
    base.menu.hv = lighterBrown;
    base.reaction.me = green;
    base.primary = lightGreen;
    base.link.underline = lightGreen;
    base.toast.success.bg = green;

    return base;
}

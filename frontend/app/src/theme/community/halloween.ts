import type { Theme } from "../types";
import { hexPercent } from "../utils";

const orange = "#fc8e0f";
const darkOrange = "#f3722b";
const lightGreen = "#0bcd04";
const green = "#097905";
const yellow = "#ffc142";
const grey = "#fbfaf4";
const darkBrown = "#1e1203";
const lighterBrown = "#281805";

const txt = grey;
const txtLight = hexPercent(yellow, 80);

export function getTheme(base: Theme): Theme {
    base.author = "2yfsq-kaaaa-aaaaf-aaa4q-cai";
    base.name = "halloween";
    base.label = "Halloween";
    base.burst = false;
    base.bd = hexPercent(orange, 30);
    base.bg =
        "linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.7)), url('/assets/halloween.webp') center/cover no-repeat";
    base.scrollbar.bg = hexPercent(orange, 30);
    base.txt = txt;
    base["txt-light"] = txtLight;
    base.accent = green;
    base.code = {
        txt: green,
        bg: "rgba(0,0,0,0.8)",
    };
    base.icon.txt = yellow;
    base.icon.selected = lightGreen;
    base.button.bg = orange;
    base.button.hv = darkOrange;
    base.button.txt = txt;
    base.button.disabled = lighterBrown;
    base.button["disabled-txt"] = hexPercent(darkOrange, 90);
    base.button["disabled-bd"] = base.bd;
    base.audio.outer = green;
    base.audio.inner = yellow;
    base.audio.me.outer = green;
    base.audio.me.inner = yellow;
    base.audio.note = txt;
    base.audio.me.note = txt;

    base.collapsible.closed.header.txt = txt;
    base.collapsible.open.header.arrow = lightGreen;

    base.panel.left.bg = hexPercent(darkBrown, 80);
    base.panel.right.modal = darkBrown;
    base.panel.right.bg = hexPercent(darkBrown, 80);
    base.modal.bd = base.bd;
    base.modal.bg = darkBrown;

    base.currentChat.msg.bg = darkBrown;
    base.currentChat.msg.bd = `1px solid ${hexPercent(yellow, 50)}`;
    base.currentChat.msg.me.bg = darkOrange;
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

    base.daily.header = darkBrown;
    base.daily.accent = base.accent;
    base.daily.accentText = txt;
    base.daily.background = darkBrown;
    base.daily.backgroundAccent = orange;
    base.daily.border = orange;
    base.daily.mainAreaBg = darkBrown;
    base.daily.mainAreaBgAccent = base.accent;
    base.daily.mainAreaText = txt;
    base.daily.supportiveText = "#4e5670";

    return base;
}

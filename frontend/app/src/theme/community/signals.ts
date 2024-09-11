import type { Theme } from "../types";
import { hexPercent } from "../utils";

const black = "#000000";
const txt = "#242834";
const txt70 = hexPercent(txt, 70);
const txt60 = hexPercent(txt, 60);
const disabledTxt = txt70;
const white = "#ffffff";
const powderBlue = "rgb(56, 183, 240)";
// const pink = "#F865B0";
const yellow = "rgb(248, 255, 131)";
const red = "#E31A3E";

export function getTheme(base: Theme): Theme {
    base.hidden = false;
    base.author = "2yfsq-kaaaa-aaaaf-aaa4q-cai";
    base.name = "signals";
    base.label = "Signals";
    base.bg = white;
    base.burst = false;
    base.logo = false;
    base.primary = powderBlue;
    base.accent = red;
    base.placeholder = black;
    base.txt = txt;
    base["txt-light"] = txt70;
    base.bd = black;
    base.rd = "0";
    base.bw = "2px";
    base.disabledTxt = txt70;
    base.placeholder = txt60;
    base.progress.bd = "rgba(0,0,0,0.2)";
    base.collapsible.closed.header.txt = txt70;
    base.timeline.txt = black;
    base.time.txt = txt60;
    base.input.bg = yellow;
    base.input.sh = "none";
    base.input.bd = black;
    base.input.accent = red;
    base.entry.bg = yellow;
    base.entry.input.bg = white;
    base.entry.input.rd = "0";
    base.entry.input.sh = "none";
    base.entry.input.bd = black;
    base.panel.bg = "transparent";
    base.panel.nav.bg = white;
    base.panel.left.bg = "transparent";
    base.panel.right.bg = "transparent";
    base.panel.right.modal = white;
    base.chatSearch.bg = white;
    base.chatSearch.bd = black;
    base.chatSearch.rd = "0";
    base.chatSummary["bg-selected"] = powderBlue;
    base.chatSummary.hv = yellow;
    base.menu.txt = black;
    base.menu["disabled-txt"] = hexPercent(black, 80);
    base.menu.sh = `8px 8px 0 ${powderBlue}`;
    base.menu.bd = black;
    base.menu.separator = black;
    base.menu.hv = yellow;
    base.button["disabled-txt"] = disabledTxt;
    base.button.rd = "0";
    base.button.sh = `4px 4px 0 ${powderBlue}`;
    base.modal.filter = "blur(5px)";
    base.modal.bg = white;
    base.modal.bd = "2px solid black";
    base.modal.rd = "0";
    base.modal.sh = `8px 8px 0 ${powderBlue}`;
    base.modalPage.bg = "rgba(255, 255, 255, 0.5)";
    base.modalPage.txt = txt;
    base.currentChat.msg.bg = white;
    base.currentChat.msg.r1 = "0";
    base.currentChat.msg.r2 = "0";
    base.currentChat.msg.bd = "2px solid black";
    base.currentChat.msg.muted = white;
    base.currentChat.msg.txt = black;
    base.currentChat.msg.inert = "rgba(226,226,226,0.8)";
    base.currentChat.msg.me.bd = black;
    base.currentChat.msg.me.bg = red;
    base.currentChat.date.bg = "rgba(239 239 239 / 80%)";
    base.icon.txt = black;
    base.icon.hv = white;
    base.icon.inverted.txt = black;
    base.icon.selected = black;
    base.recommended.bg = white;
    base.markdown.fg.color = txt;
    base.markdown.fg.bright = txt;
    base.markdown.fg.muted = txt70;
    base.members.hv = yellow;
    base.card.rd = "0";
    base.card.sh = `8px 8px 0 ${powderBlue}`;

    base.daily.header = white;
    base.daily.accent = base.accent;
    base.daily.accentText = txt;
    base.daily.background = white;
    base.daily.backgroundAccent = white;
    base.daily.border = base.bd;
    base.daily.mainAreaBg = white;
    base.daily.mainAreaBgAccent = base.accent;
    base.daily.mainAreaText = txt;
    base.daily.supportiveText = "#4e5670";

    return base;
}

import type { Theme } from "../types";
import { hexPercent } from "../utils";

const textBox = "rgba(226,226,226,0.4)";
const txt = "#000000";
const txt40 = hexPercent(txt, 40);
const txt60 = hexPercent(txt, 60);
const txt80 = hexPercent(txt, 80);
const disabledTxt = txt40;
const white = "#FDFFFF";
const black = "#000000";
const silver = "#C0C0C0";
const trolleyGray = "#818181";
const msBlue = "#010081";
const magenta = "#ff0081";
const successGreen = "#28a745";
const errorRed = "#dc3545";
const green = "#008080";

export function getTheme(base: Theme): Theme {
    base.author = "y3rqn-fyaaa-aaaaf-a7z6a-cai";
    base.name = "windoge98";
    base.label = "Windoge98";
    base.bg = `${green} url('/assets/windoge98logo.png') bottom 60px right 10px no-repeat`;
    base.burst = false;
    base.logo = false;
    base.txt = txt80;
    base["txt-light"] = txt60;
    base.bd = "#b0b0b0";
    base.rd = "0";
    base.primary = "#0884CE";
    base.accent = magenta;
    base.disabledTxt = txt40;
    base.placeholder = txt60;
    base.fontUrl = "https://fonts.googleapis.com/css2?family=Ubuntu+Mono:wght@400;700&display=swap";
    base.font = `'Ubuntu Mono', monospace`;
    base["font-bold"] = `'Ubuntu Mono', monospace`;

    base.timeline.txt = txt40;
    base.time.txt = txt60;
    base.time.icon = "rgba(0,0,0,0.3)";
    base.time.bg = "rgba(0,0,0,0.1)";
    base.time.me.txt = white;
    base.time.me.icon = white;
    base.time.me.bg = "rgba(255,255,255,0.2)";

    base.code = {
        bg: "rgba(0,0,0,0.8)",
        txt: "#38e838",
    };

    base.input.bg = white;
    base.input.accent = msBlue;
    base.input.sh = "inset 0px 2px 4px rgba(0, 0, 0, 0.6)";

    base.entry.bg = silver;
    base.entry.input.bg = white;
    base.entry.input.rd = "0";
    base.entry.input.sh = "inset 0px 2px 4px rgba(0, 0, 0, 0.6)";

    base.panel.bg = msBlue;
    base.panel.left.bg = silver;
    base.panel.right.bg = silver;
    base.panel.nav.bg = "linear-gradient(#0884CE, #21219c)";
    base.panel.right.modal = silver;

    base.chatSearch.bg = textBox;
    base.chatSearch.rd = "0";
    base.chatSummary.hv = "rgba(255,255,255,0.4)";
    base.chatSearch.sh = "inset 0px 2px 4px rgba(0, 0, 0, 0.6)";
    base.chatSummary["bg-selected"] = "rgba(255,255,255,0.6)";

    base.menu.txt = txt80;
    base.menu.bg = silver;
    base.menu.bd = trolleyGray;
    base.menu.separator = trolleyGray;
    base.menu["disabled-txt"] = txt60;
    base.menu.warn = errorRed;
    base.menu.sh = "none";

    base.button["disabled-txt"] = disabledTxt;
    base.button.bg = msBlue;
    base.button.hv = magenta;
    base.button.rd = "0";

    base.avatar.rd = "0";
    base.toggle.rd.track = "0";
    base.toggle.rd.thumb = "0";
    base.nav.icon.rd = "0";

    base.modal.filter = "blur(5px)";
    base.modal.bg = silver;
    base.modalPage.bg = trolleyGray;
    base.modalPage.txt = txt;
    base.modal.rd = "0";
    base.modal.sh = "none";

    base.currentChat.msg.bd = trolleyGray;
    base.currentChat.msg.bg = silver;
    base.currentChat.msg.muted = trolleyGray;
    base.currentChat.msg.txt = txt60;
    base.currentChat.msg.inert = "rgba(226,226,226,0.8)";
    base.currentChat.msg.separator = "rgba(0,0,0,0.1)";
    base.currentChat.msg.me.bd = "rgba(255,255,255,0.05)";
    base.currentChat.msg.me.bg = msBlue;
    base.currentChat.date.bg = "rgba(239 239 239 / 80%)";
    base.currentChat.msg.r1 = "0";
    base.currentChat.msg.r2 = "0";

    base.icon.txt = black;
    base.icon.inverted.txt = black;
    base.icon.selected = white;

    base.recommended.bg = white;
    base.markdown.fg.color = txt;
    base.markdown.fg.bright = txt;

    base.vote.yes.color = successGreen;
    base.vote.no.color = errorRed;

    base.notificationBar.bg = magenta;
    base.notificationBar.txt = white;

    // misc
    base.link.underline = msBlue;
    base.progress.bd = "rgba(0,0,0,0.2)";
    base.collapsible.closed.header.txt = txt40;
    base.scrollbar.bg = trolleyGray;
    base.card.rd = "0";

    // daily
    base.daily.header = green;
    base.daily.accent = base.accent;
    base.daily.accentText = txt;
    base.daily.background = green;
    base.daily.backgroundAccent = silver;
    base.daily.border = base.bd;
    base.daily.mainAreaBg = green;
    base.daily.mainAreaBgAccent = silver;
    base.daily.mainAreaText = txt;
    base.daily.supportiveText = "#4e5670";

    base.audio.outer = base.primary;
    base.audio.me.outer = base.accent;
    base.audio.inner = base.accent;
    base.audio.me.inner = green;
    base.audio.note = base.currentChat.msg.txt;
    base.audio.me.note = base.currentChat.msg.me.txt;

    return base;
}

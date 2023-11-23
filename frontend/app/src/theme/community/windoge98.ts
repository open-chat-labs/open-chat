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
const darkGray = "#696969";
const magenta = "#ff0081";
const teal = "#008080";
const successGreen = "#28a745";
const errorRed = "#dc3545";

export function getTheme(base: Theme): Theme {
    base.author = "rh2pm-ryaaa-aaaan-qeniq-cai";
    base.name = "windoge98";
    base.label = "Windoge98";
    base.bg = "#008080 url('/assets/windoge98logo.png') bottom 60px right 10px no-repeat";
    base.burst = false;
    base.logo = false;
    base.txt = txt80;
    base["txt-light"] = txt60;
    base.bd = silver;
    base.rd = "0";
    base.link.underline = msBlue;
    base.disabledTxt = txt40;
    base.placeholder = txt60;
    base.progress.bd = "rgba(0,0,0,0.2)";
    base.collapsible.closed.header.txt = txt40;
    base.primary = "#0884CE";
    base.accent = magenta;
    base.scrollbar.bg = trolleyGray;


    base.timeline.txt = txt40;
    base.time.txt = txt60;
    base.time.icon = "rgba(0,0,0,0.3)";
    base.time.bg = "rgba(0,0,0,0.1)";
    base.time.me.txt = white;
    base.time.me.icon = white;
    base.time.me.bg = "rgba(255,255,255,0.2)";

    base.input.bg = white;
    base.input.accent = msBlue;

    base.entry.bg = silver;
    base.entry.input.bg = white;
    base.entry.input.rd = "0";
    base.entry.input.sh = "";

    base.panel.bg = msBlue;
    base.panel.left.bg = silver;
    base.panel.right.bg = silver;
    base.panel.right.modal = "linear-gradient(#0884CE, #21219c)";

    base.chatSearch.bg = textBox;
    base.chatSummary.hv = "rgba(255,255,255,0.4)";
    base.chatSummary["bg-selected"] = "rgba(255,255,255,0.6)";

    base.menu.txt = txt80;
    base.menu.bg = trolleyGray;
    base.menu.bd = darkGray;
    base.menu["disabled-txt"] = txt60;
    base.menu.warn = errorRed;

    base.button["disabled-txt"] = disabledTxt;
    base.button.bg = msBlue;
    base.button.hv = magenta;

    base.card.rd = "0";
    base.modal.filter = "blur(5px)";
    base.modal.bg = silver;
    base.modal.bd = silver;
    base.modalPage.bg = trolleyGray;
    base.modalPage.txt = txt;

    base.currentChat.msg.bd = trolleyGray;
    base.currentChat.msg.bg = silver;
    base.currentChat.msg.muted = trolleyGray;
    base.currentChat.msg.txt = txt60;
    base.currentChat.msg.inert = "rgba(226,226,226,0.8)";
    base.currentChat.msg.separator = "rgba(0,0,0,0.1)";
    base.currentChat.msg.me.bd = "rgba(255,255,255,0.05)";
    base.currentChat.msg.me.bg = msBlue;
    base.currentChat.date.bg = "rgba(239 239 239 / 80%)";

    base.icon.txt = black;
    base.icon.inverted.txt = black;
    base.icon.selected = white;
    
    base.recommended.bg = white;
    base.markdown.fg.color = txt;
    base.markdown.fg.bright = txt;
    base.markdown.fg.muted = txt40;

    base.vote.yes.color = successGreen;
    base.vote.no.color = errorRed;

    return base;
}

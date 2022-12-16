import type { Theme } from "../types";
import { hexPercent } from "../themes";

const textBox = "rgba(226,226,226,0.5)";
const txt = "#242834";
const txt70 = hexPercent(txt, 70);
const txt60 = hexPercent(txt, 60);
const txtDark = "#242834";
const disabledTxt = txt70;
const white = "#ffffff";

export function getTheme(base: Theme): Theme {
    base.name = "white";
    base.label = "White";
    base.bg = white;
    base.burst = true;
    base.txt = txt;
    base["txt-light"] = txt70;
    base.bd = "#ededed";
    base.disabledTxt = txt70;
    base.placeholder = txt60;
    base.progress.bd = "rgba(0,0,0,0.2)";
    base.collapsible.closed.header.txt = txt70;
    base.timeline.txt = txt70;
    base.input.bg = textBox;
    base.entry.input.bg = white;
    base.entry.input.sh = "inset 0px 2px 4px rgba(138, 138, 138, 0.5)";
    base.panel.bg = "transparent";
    base.panel.left.bg = "transparent";
    base.panel.right.bg = "transparent";
    base.panel.right.modal = white;
    base.chatSearch.bg = textBox;
    base.chatSummary["bg-selected"] = "rgba(226,226,226,0.5)";
    base.menu.txt = txt70;
    base.menu["disabled-txt"] = hexPercent(txtDark, 50);
    base.button["disabled-txt"] = disabledTxt;
    base.modal.filter = "blur(5px)";
    base.modal.bg = white;
    base.modal.bd = "none";
    base.modalPage.bg = "rgba(255, 255, 255, 0.5)";
    base.modalPage.txt = txt;
    base.currentChat.msg.bg = "rgba(226,226,226,0.5)";
    base.currentChat.msg.muted = "rgba(255,255,255,0.6)";
    base.currentChat.msg.txt = txt70;
    base.currentChat.msg.inert = "rgba(226,226,226,0.8)";
    base.currentChat.msg.me.bd = "rgba(0,0,0,0.05)";
    base.currentChat.msg.me.bg = base.primary;
    base.currentChat.date.bg = "rgba(239 239 239 / 80%)";
    base.icon.txt = txt60;
    base.icon.inverted.txt = txt60;
    base.icon.selected = base.primary;
    base.recommended.bg = white;
    base.markdown.fg.color = txt;
    base.markdown.fg.bright = txt;
    base.markdown.fg.muted = txt70;

    return base;
}

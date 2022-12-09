import type { Theme } from "../types";
import { hexPercent } from "../themes";

const red100 = "#ae1111";
const txtLight = "#922222";
const txt = red100;

export function getTheme(base: Theme): Theme {
    // it's ok to mutate the theme passed in because it's a clone
    base.name = "submarine";
    base.label = "Submarine";
    base.burst = false;
    base.bg = "radial-gradient(circle, rgba(66,5,5,1) 20%, rgba(0,0,0,1) 79%)";
    base.bd = "#4f1515";
    base.txt = txt;
    base["txt-light"] = txtLight;
    base.icon.txt = red100;
    base.collapsible.closed.header.txt = txt;
    base.collapsible.open.header.arrow = red100;
    base.accent = "#87441c";
    base.panel.left.bg = "rgba(0,0,0,0.1)";
    base.panel.right.modal = "#211b1b";
    base.modal.bd = base.bd;
    base.modal.bg = base.panel.right.modal;
    base.chatSummary["bg-selected"] = "rgb(64 55 55 / 40%)";
    base.chatSummary.hv = "rgb(64 55 55 / 30%)";
    base.members.hv = base.chatSummary.hv;
    base.placeholder = txtLight;
    base.entry.input.bg = "#2a1e1e";
    base.input.bg = "#2a1e1e";
    base.chatSearch.bg = "#2a1e1e";
    base.button.bg = "#7c0a0a";
    base.button.hv = "#5b0505";
    base.button.txt = "rgba(255 255 255 / 80%)";
    base.button.disabled = "#2a1e1e";
    base.currentChat.msg.bg = "#342424";
    base.currentChat.msg.me.bg = hexPercent(base.button.bg, 70);
    base.currentChat.msg.txt = "rgba(255 255 255 / 50%)";
    base.notificationBar.bg = "#8b3403";
    base.notificationBar.txt = "rgba(255 255 255 / 50%)";
    base.timeline.txt = base.notificationBar.txt;
    base.menu.bd = "#4f1515";
    base.menu.bg = "#221b1b";
    base.menu.txt = txt;
    base.menu["disabled-txt"] = txtLight;
    base.icon.inverted.txt = txt;
    base.menu.hv = base.chatSummary.hv;
    base.reaction.me = red100;
    base.primary = red100;
    base.link.underline = base.primary;
    base.scrollbar.bg = base.button.hv;

    return base;
}

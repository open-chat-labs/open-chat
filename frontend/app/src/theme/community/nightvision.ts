import type { Theme } from "../types";
import { hexPercent } from "../themes";

const green = "#0d8329";
const txtLight = "#0d8329ba";
const txt = green;

export function getTheme(base: Theme): Theme {
    // it's ok to mutate the theme passed in because it's a clone
    base.name = "nightvision";
    base.label = "Nightvision";
    base.burst = false;
    base.bg = "radial-gradient(circle, rgba(4,48,10,1) 10%, rgba(0,0,0,1) 79%)";
    base.bd = "#0f3918";
    base.txt = txt;
    base["txt-light"] = txtLight;
    base.icon.txt = green;
    base.collapsible.closed.header.txt = txt;
    base.collapsible.open.header.arrow = green;
    base.accent = "#a9be54";
    base.panel.left.bg = "rgba(0,0,0,0.1)";
    base.panel.right.modal = "#151a15";
    base.modal.bd = base.bd;
    base.modal.bg = base.panel.right.modal;
    base.chatSummary["bg-selected"] = "rgb(39 65 39 / 40%)";
    base.chatSummary.hv = "rgb(39 65 39 / 30%)";
    base.members.hv = base.chatSummary.hv;
    base.placeholder = txtLight;
    base.entry.input.bg = "#151f19";
    base.input.bg = "#151f19";
    base.chatSearch.bg = "#151f19";
    base.button.bg = "#084a16";
    base.button.hv = "#094a17";
    base.button.disabled = "#151f19";
    base.button.txt = "rgba(255 255 255 / 80%)";
    base.currentChat.msg.bg = "#243427";
    base.currentChat.msg.me.bg = hexPercent(base.button.bg, 70);
    base.currentChat.msg.txt = "rgba(255 255 255 / 50%)";
    base.currentChat.date.bg = base.currentChat.msg.bg;
    base.currentChat.msg.inert = base.currentChat.msg.bg;
    base.currentChat.msg.me.bg = hexPercent(base.button.bg, 70);
    base.notificationBar.bg = "#04621f";
    base.notificationBar.txt = "rgba(255 255 255 / 50%)";
    base.timeline.txt = base.notificationBar.txt;
    base.menu.bd = base.bd;
    base.menu.bg = base.panel.right.modal;
    base.menu.txt = txt;
    base.menu["disabled-txt"] = txtLight;
    base.icon.inverted.txt = txt;
    base.menu.hv = base.chatSummary.hv;
    base.reaction.me = green;
    base.primary = green;
    base.link.underline = base.primary;
    base.scrollbar.bg = base.button.hv;

    return base;
}

import type { Theme } from "../types";
import { hexPercent } from "../utils";

const green = "#0d8329";
const txtLight = "#0d8329ba";
const txt = green;
const componentBg = "#151f19";
const accent = "#a9be54";

export function getTheme(base: Theme): Theme {
    // it's ok to mutate the theme passed in because it's a clone
    base.author = "2yfsq-kaaaa-aaaaf-aaa4q-cai";
    base.name = "nightvision";
    base.label = "Nightvision";
    base.burst = false;
    base.bg = "radial-gradient(circle, rgba(4,48,10,1) 10%, rgba(0,0,0,1) 79%)";
    base.bd = "#0f3918";
    base.txt = txt;
    base["txt-light"] = txtLight;
    base.icon.txt = green;
    base.icon.selected = "limegreen";
    base.button.bg = "#084a16";
    base.button.hv = "#094a17";
    base.button.disabled = componentBg;
    base.button.txt = "rgba(255 255 255 / 80%)";
    base.collapsible.closed.header.txt = txt;
    base.collapsible.open.header.arrow = green;
    base.accent = accent;
    base.panel.left.bg = "rgba(0,0,0,0.1)";
    base.panel.right.modal = "#151a15";
    base.modal.bd = base.bd;
    base.modal.bg = base.panel.right.modal;
    base.chatSummary["bg-selected"] = "rgb(39 65 39 / 40%)";
    base.chatSummary.hv = "rgb(39 65 39 / 30%)";
    base.chatSummary.del = base.button.bg;
    base.members.hv = base.chatSummary.hv;
    base.placeholder = txtLight;
    base.entry.input.bg = componentBg;
    base.input.bg = componentBg;
    base.chatSearch.bg = componentBg;
    base.currentChat.msg.bg = "#243427";
    base.currentChat.msg.me.bg = hexPercent(base.button.bg, 70);
    base.currentChat.msg.txt = "rgba(255 255 255 / 50%)";
    base.currentChat.date.bg = base.currentChat.msg.bg;
    base.currentChat.msg.inert = base.currentChat.msg.bg;
    base.notificationBar.bg = "#04621f";
    base.notificationBar.txt = "rgba(255 255 255 / 50%)";
    base.timeline.txt = base.notificationBar.txt;
    base.menu.bd = base.bd;
    base.menu.bg = base.panel.right.modal;
    base.menu.txt = txt;
    base.menu.warn = txt;
    base.menu["disabled-txt"] = txtLight;
    base.icon.inverted.txt = txt;
    base.menu.hv = base.chatSummary.hv;
    base.reaction.me = green;
    base.primary = green;
    base.link.underline = base.primary;
    base.scrollbar.bg = base.button.hv;
    base.toast.success.bg = base.notificationBar.bg;
    base.audio.outer = green;
    base.audio.me.outer = green;
    base.audio.inner = accent;
    base.audio.me.inner = accent;
    base.audio.note = txt;
    base.audio.me.note = txt;

    return base;
}

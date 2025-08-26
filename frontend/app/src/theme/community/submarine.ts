import type { Theme } from "../types";
import { hexPercent } from "../utils";

const red100 = "#ae1111";
const txtLight = "#922222";
const txt = red100;
const componentBg = "#2a1e1e";
const accent = "#87441c";

export function getTheme(base: Theme): Theme {
    // it's ok to mutate the theme passed in because it's a clone
    base.author = "2yfsq-kaaaa-aaaaf-aaa4q-cai";
    base.name = "submarine";
    base.label = "Submarine";
    base.burst = false;
    base.bg = "radial-gradient(circle, rgba(66,5,5,1) 20%, rgba(0,0,0,1) 79%)";
    base.bd = "#4f1515";
    base.txt = txt;
    base["txt-light"] = txtLight;
    base.icon.txt = red100;
    base.icon.selected = "red";
    base.button.bg = "#7c0a0a";
    base.button.hv = "#5b0505";
    base.button.txt = "rgba(255 255 255 / 80%)";
    base.button.disabled = componentBg;
    base.collapsible.closed.header.txt = txt;
    base.collapsible.open.header.arrow = red100;
    base.accent = accent;
    base.panel.left.bg = "rgba(0,0,0,0.1)";
    base.panel.right.modal = "#211b1b";
    base.modal.bd = base.bd;
    base.modal.bg = base.panel.right.modal;
    base.chatSummary["bg-selected"] = "rgb(64 55 55 / 40%)";
    base.chatSummary.hv = "rgb(64 55 55 / 30%)";
    base.chatSummary.del = base.button.bg;
    base.members.hv = base.chatSummary.hv;
    base.placeholder = txtLight;
    base.entry.input.bg = componentBg;
    base.input.bg = componentBg;
    base.chatSearch.bg = componentBg;
    base.currentChat.msg.bg = "#342424";
    base.currentChat.msg.me.bg = hexPercent(base.button.bg, 70);
    base.currentChat.msg.txt = "rgba(255 255 255 / 50%)";
    base.currentChat.date.bg = base.currentChat.msg.bg;
    base.currentChat.msg.inert = base.currentChat.msg.bg;
    base.notificationBar.bg = "#8b3403";
    base.notificationBar.txt = "rgba(255 255 255 / 50%)";
    base.timeline.txt = base.notificationBar.txt;
    base.menu.bd = base.bd;
    base.menu.bg = base.panel.right.modal;
    base.menu.txt = txt;
    base.menu.warn = txt;
    base.menu["disabled-txt"] = txtLight;
    base.icon.inverted.txt = txt;
    base.menu.hv = base.chatSummary.hv;
    base.reaction.me = red100;
    base.primary = red100;
    base.link.underline = base.primary;
    base.scrollbar.bg = base.button.hv;
    base.toast.success.bg = base.notificationBar.bg;
    base.audio.outer = red100;
    base.audio.me.outer = red100;
    base.audio.inner = accent;
    base.audio.me.inner = accent;
    base.audio.note = txt;
    base.audio.me.note = txt;

    return base;
}

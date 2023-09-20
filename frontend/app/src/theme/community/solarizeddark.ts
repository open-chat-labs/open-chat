import type { Theme } from "../types";

const veryDarkCyan = "#002b36";
const darkCyan = "#073642";
const darkCyan2 = "#0c586ba6";
const darkBlue = "#186899";
const gray = "#8b9898";
const lightishGray = "#90aba7";
const lightGray = "#d6dddc";
const olive = "#748c09";

const txt = lightGray;
const txtLight = lightishGray;

export function getTheme(base: Theme): Theme {
    base.author = "j67p2-qaaaa-aaaaf-aa3cq-cai";
    base.name = "solarizeddark";
    base.label = "Solarized Dark";
    base.burst = false;
    base.bg = veryDarkCyan;
    base.bd = "rgba(255,255,255,0.2)";
    base.txt = txt;
    base["txt-light"] = txtLight;
    base.icon.txt = olive;
    base.icon.selected = olive;
    base.button.bg = darkBlue;
    base.button.hv = olive;
    base.button.txt = txt;
    base.button.disabled = veryDarkCyan;
    base.collapsible.closed.header.txt = txt;
    base.collapsible.open.header.arrow = olive;
    base.accent = olive;
    base.panel.left.bg = darkCyan;
    base.panel.right.modal = veryDarkCyan;
    base.modal.bd = base.bd;
    base.modal.bg = base.panel.right.modal;
    base.chatSummary["bg-selected"] = darkCyan2;
    base.chatSummary.hv = veryDarkCyan;
    base.chatSummary.del = base.button.bg;
    base.members.hv = darkCyan2;
    base.placeholder = txtLight;
    base.entry.input.bg = veryDarkCyan;
    base.input.bg = veryDarkCyan;
    base.chatSearch.bg = veryDarkCyan;
    base.currentChat.msg.bg = darkCyan;
    base.currentChat.msg.me.bg = darkCyan2;
    base.currentChat.msg.txt = txtLight;
    base.currentChat.date.bg = base.currentChat.msg.bg;
    base.currentChat.msg.inert = base.currentChat.msg.bg;
    base.notificationBar.bg = gray;
    base.notificationBar.txt = txtLight;
    base.timeline.txt = base.notificationBar.txt;
    base.menu.bd = base.bd;
    base.menu.bg = base.panel.right.modal;
    base.menu.txt = txt;
    base.menu.warn = txt;
    base.menu["disabled-txt"] = txtLight;
    base.icon.inverted.txt = txt;
    base.menu.hv = darkCyan2;
    base.reaction.me = olive;
    base.primary = olive;
    base.link.underline = base.primary;
    base.scrollbar.bg = base.button.hv;
    base.toast.success.bg = base.notificationBar.bg;

    return base;
}

import type { Theme } from "../types";

// Colors
const white = "#FFFFFF";
const offWhite = "#DFDFDF";
const black = "#000000";
const raspberry = "#971E57";
const darkGray = "#696969";
const silver = "#C0C0C0";
const veryDarkGray = "#1e2123";
const lighterDarkGray = "#101010";
const txtLight = offWhite;
const notificationAccent = silver;

export function getTheme(base: Theme): Theme {
    // it's ok to mutate the theme passed in because it's a clone
    base.name = "tokyonight";
    base.label = "Tokyo Night";
    base.burst = false;
    base.bg = "radial-gradient(circle, rgba(242,154,216,1) 5%, rgba(10,10,10,1) 70%)";
    base.bd = darkGray;
    base.txt = white;
    base["txt-light"] = txtLight;
    base.icon.txt = darkGray;
    base.icon.selected = raspberry;
    base.button.bg = raspberry;
    base.button.hv = rasperry;
    base.button["hv-txt"] = darkGray;
    base.button.txt = "rgba(255 255 255 / 80%)";
    base.button.disabled = silver;
    base.collapsible.closed.header.txt = txt;
    base.collapsible.open.header.arrow = white;
    base.accent = raspberry;
    base.panel.left.bg = veryDarkGray;
    base.panel.right.modal = lighterDarkGray;
    base.modal.bd = raspberry;
    base.modal.bg = raspberry;
    base.chatSummary["bg-selected"] = "rgb(24,24,24 / 40%)";
    base.chatSummary.hv = "rgb(24,24,24 / 80%)";
    base.chatSummary.del = base.button.bg;
    base.members.hv = base.chatSummary.hv;
    base.placeholder = silver;
    base.entry.bg = veryDarkGray;
    base.entry.input.bg = veryDarkGray;
    base.input.bg = raspberry;
    base.input.accent = raspberry;
    base.chatSearch.bg = veryDarkGray;
    base.currentChat.msg.bg = veryDarkGray;
    base.currentChat.msg.me.bg = raspberry;
    base.currentChat.msg.txt = white;
    base.currentChat.date.bg = base.currentChat.msg.bg;
    base.currentChat.msg.inert = base.currentChat.msg.bg;
    base.notificationBar.bg = veryDarkGray;
    base.notificationBar.txt = white;
    base.timeline.txt = base.notificationBar.txt;
    base.menu.bd = white;
    base.menu.bg = lighterDarkGray;
    base.menu.txt = txt;
    base.menu.warn = txt;
    base.menu["disabled-txt"] = white;
    base.icon.inverted.txt = silver;
    base.menu.hv = raspberry;
    base.reaction.me = white;
    base.reaction.bg = veryDarkGray;
    base.primary = raspberry;
    base.link.underline = raspberry;
    base.scrollbar.bg = raspberry;
    base.toast.success.bg = base.notificationBar.bg;
    base.code = white;
    base.entry.input.sh = "none";
    base.input.sh = "none";
    base.chatSearch.sh = "none";
    base.recommended.bg = raspberry;
    base.unread["mute-solid"] = raspberry;

    return base;
}

import type { Theme } from "../types";

// Colors
const white = "#FFFFFF";
const raspberry = "#971E57";
const darkGray = "#696969";
const silver = "#C0C0C0";
const veryDarkGray = "#1e2123";
const lighterDarkGray = "#101010";
const lightPurple = "#864893";
const txt = white;

export function getTheme(base: Theme): Theme {
    // it's ok to mutate the theme passed in because it's a clone
    base.author = "j67p2-qaaaa-aaaaf-aa3cq-cai";
    base.name = "tokyonight";
    base.label = "Tokyo Night";
    base.burst = true;
    base.bg = "radial-gradient(circle, #69173e 5%, rgb(6 1 22) 100%)";
    base.bd = darkGray;
    base.txt = white;
    base.icon.txt = darkGray;
    base.icon.selected = raspberry;
    base.button.bg = raspberry;
    base.button.hv = raspberry;
    base.button["hv-txt"] = white;
    base.button["disabled-txt"] = darkGray;
    base.button.txt = "rgba(255 255 255 / 80%)";
    base.button.disabled = silver;
    base.collapsible.closed.header.txt = txt;
    base.collapsible.open.header.arrow = white;
    base.accent = raspberry;
    base.progress.fill = lightPurple;
    base.panel.left.bg = veryDarkGray;
    base.panel.right.modal = lighterDarkGray;
    base.modal.bd = darkGray;
    base.modal.bg = lighterDarkGray;
    base.chatSummary["bg-selected"] = "rgb(54 59 62 / 50%)";
    base.chatSummary.hv = "rgb(24 24 24 / 80%)";
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
    base.primary = lightPurple;
    base.link.underline = white;
    base.scrollbar.bg = raspberry;
    base.toast.success.bg = base.notificationBar.bg;
    base.code = {
        txt: white,
        bg: "black",
    };
    base.entry.input.sh = "none";
    base.input.sh = "none";
    base.chatSearch.sh = "none";
    base.recommended.bg = raspberry;
    base.unread["mute-solid"] = raspberry;

    base.audio.outer = lightPurple;
    base.audio.me.outer = lightPurple;
    base.audio.inner = silver;
    base.audio.me.inner = silver;
    base.audio.note = txt;
    base.audio.me.note = txt;

    return base;
}

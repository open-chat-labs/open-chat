import type { Theme } from "../types";

// Colors
const white = "#FFFFFF";
const pink1 = "#f29ad8";
const pink2 = "#ee71c3";
const pink3 = "#e448a3";
const barbieYellow = "#f9dd9a";
const barbieBlue = "#87ced0";

const txtLight = white;
const txt = white;

const notificationAccent = barbieYellow;
const yourMessageBackground = "#e742ad";
const friendsMessageBackground = "#94c6c9";

export function getTheme(base: Theme): Theme {
    // it's ok to mutate the theme passed in because it's a clone
    base.author = "e2rfi-fqaaa-aaaaf-aa5ua-cai";
    base.name = "barbie";
    base.label = "Barbie";
    base.burst = false;
    base.bg = "radial-gradient(circle, rgba(242,154,216,1) 10%, rgba(238,113,195,1) 80%)";
    base.bd = "#e305ad";
    base.bd = "rgba(255,255,255,0.2)";
    base.txt = txt;
    base["txt-light"] = txtLight;
    base.icon.txt = white;
    base.icon.selected = barbieBlue;
    base.button.bg = barbieBlue;
    base.button.hv = barbieYellow;
    base.button["hv-txt"] = barbieBlue;
    base.button.txt = "rgba(255 255 255 / 80%)";
    base.button.disabled = pink1;
    base.collapsible.closed.header.txt = txt;
    base.collapsible.open.header.arrow = white;
    base.accent = barbieYellow;
    base.panel.nav.bg = pink3;
    base.panel.left.bg = pink3;
    base.panel.right.modal = "#e1349a";
    base.modal.bd = base.bd;
    base.modal.bg = pink3;
    base.chatSummary["bg-selected"] = "#e75aac";
    base.chatSummary.hv = "rgb(225 52 154 / 80%)";
    base.chatSummary.del = base.button.bg;
    base.members.hv = base.chatSummary.hv;
    base.placeholder = txtLight;
    base.entry.bg = pink3;
    base.entry.input.bg = pink1;
    base.input.bg = pink1;
    base.input.accent = barbieBlue;
    base.chatSearch.bg = pink2;
    base.currentChat.msg.bg = friendsMessageBackground;
    base.currentChat.msg.me.bg = yourMessageBackground;
    base.currentChat.msg.txt = white;
    base.currentChat.date.bg = base.currentChat.msg.bg;
    base.currentChat.msg.inert = base.currentChat.msg.bg;
    base.notificationBar.bg = notificationAccent;
    base.notificationBar.txt = white;
    base.timeline.txt = base.notificationBar.txt;
    base.menu.bd = base.bd;
    base.menu.bg = "#e75aac";
    base.menu.txt = txt;
    base.menu.warn = txt;
    base.menu["disabled-txt"] = white;
    base.icon.inverted.txt = barbieYellow;
    base.menu.hv = pink2;
    base.reaction.me = white;
    base.reaction.bg = barbieBlue;
    base.primary = barbieBlue;
    base.link.underline = base.primary;
    base.scrollbar.bg = base.button.hv;
    base.toast.success.bg = base.notificationBar.bg;
    base.code = {
        bg: white,
        txt: pink1,
    };
    base.entry.input.sh = "none";
    base.input.sh = "none";
    base.chatSearch.sh = "none";
    base.recommended.bg = pink3;
    base.unread["mute-solid"] = pink3;
    base.daily.header = pink1;
    base.daily.accent = barbieBlue;
    base.daily.accentText = txt;
    base.daily.background = pink1;
    base.daily.backgroundAccent = barbieBlue;
    base.daily.border = "#ffffff30";
    base.daily.mainAreaBg = pink1;
    base.daily.mainAreaBgAccent = barbieYellow;
    base.daily.mainAreaText = txt;
    base.daily.supportiveText = txtLight;

    base.audio.outer = pink3;
    base.audio.me.outer = barbieBlue;
    base.audio.inner = barbieYellow;
    base.audio.me.inner = barbieYellow;
    base.audio.note = txt;
    base.audio.me.note = txt;

    return base;
}

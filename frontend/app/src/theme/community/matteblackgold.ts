import type { Theme } from "../types";

// Colors
const white = "#FFFFFF";
const offWhite = "#DFDFDF";
const black = "#000000";
const offBlack1 = "#101010";
const offBlack2 = "#121415";
const offBlack3 = "#191919";
const matteBlack = "#333333";
const gold = "#FFBF00";
const lightGold = "#ffcd36";

const txtLight = offWhite;
const txt = white;

const notificationAccent = gold;
const yourMessageBackground = matteBlack;
const friendsMessageBackground = "#111111";

export function getTheme(base: Theme): Theme {
    // it's ok to mutate the theme passed in because it's a clone
    base.author = "e2rfi-fqaaa-aaaaf-aa5ua-cai";
    base.name = "matteblackgold";
    base.label = "Matte Black Gold";
    base.burst = false;
    base.bg = "radial-gradient(circle, rgba(28,28,28,1) 10%, rgba(22,22,22,1) 79%)";
    base.bd = black;
    base.txt = txt;
    base["txt-light"] = txtLight;
    base.icon.txt = white;
    base.icon.selected = gold;
    base.button.bg = gold;
    base.button.hv = lightGold;
    base.button.txt = "rgba(255 255 255 / 80%)";
    base.button.disabled = matteBlack;
    // base.button["txt-sh"] = "1px 1px 0px rgba(0,0,0,0.7)";   // commented out for now
    base.collapsible.closed.header.txt = txt;
    base.collapsible.open.header.arrow = white;
    base.accent = gold;
    base.panel.left.bg = offBlack2;
    base.panel.right.modal = offBlack1;
    base.modal.bd = base.bd;
    base.modal.bg = base.panel.right.modal;
    base.chatSummary["bg-selected"] = "rgba(24,24,24,0.4)";
    base.chatSummary.hv = "rgba(24,24,24,0.8)";
    base.chatSummary.del = base.button.bg;
    base.members.hv = base.chatSummary.hv;
    base.placeholder = txtLight;
    base.entry.input.bg = matteBlack;
    base.input.bg = matteBlack;
    base.input.accent = gold;
    base.chatSearch.bg = matteBlack;
    base.currentChat.msg.bg = friendsMessageBackground;
    base.currentChat.msg.me.bg = yourMessageBackground;
    base.currentChat.msg.txt = white;
    base.currentChat.date.bg = base.currentChat.msg.bg;
    base.currentChat.msg.inert = base.currentChat.msg.bg;
    base.notificationBar.bg = notificationAccent;
    base.notificationBar.txt = white;
    base.timeline.txt = base.notificationBar.txt;
    base.menu.bd = base.bd;
    base.menu.bg = base.panel.right.modal;
    base.menu.txt = txt;
    base.menu.warn = txt;
    base.menu["disabled-txt"] = offWhite;
    base.icon.inverted.txt = lightGold;
    base.menu.hv = offBlack3;
    base.reaction.me = white;
    base.primary = gold;
    base.link.underline = base.primary;
    base.scrollbar.bg = base.button.hv;
    base.toast.success.bg = base.notificationBar.bg;
    base.code = {
        txt: gold,
        bg: "rgba(255,255,255,0.1)",
    };
    base.audio.outer = gold;
    base.audio.me.outer = gold;
    base.audio.inner = txt;
    base.audio.me.inner = txt;
    base.audio.note = txt;
    base.audio.me.note = txt;

    return base;
}

import type { Theme } from "../types";

// Colors
const white = "#FFFFFF"
const offWhite = "#DFDFDF"
const black = "#000000"
const offBlack1 = "#101010"
const offBlack2 = "#121415"
const offBlack3 = "#191919"
const mattBlack = "#333333"
const gold = "#FFBF00";
const lightGold = "#ffcd36";

const txtLight = offWhite;
const txt = white;

const notificationAccent = gold;
const yourMessageBackground = mattBlack;
const friendsMessageBackground = "#111111";

export function getTheme(base: Theme): Theme {
    // it's ok to mutate the theme passed in because it's a clone
    base.name = "mattblackgold";
    base.label = "Matt Black Gold";
    base.burst = false;
    base.bg = "radial-gradient(circle, rgba(42,42,42,1) 10%, rgba(20,20,20,1) 79%)";
    base.bd = black;
    base.txt = txt;
    base["txt-light"] = txtLight;
    base.icon.txt = white;
    base.icon.selected = gold;
    base.button.bg = gold;
    base.button.hv = lightGold;
    base.button.txt = "rgba(255 255 255 / 80%)";
    base.button.disabled = mattBlack;
    base.collapsible.closed.header.txt = txt;
    base.collapsible.open.header.arrow = white;
    base.accent = gold;
    base.panel.left.bg = offBlack2;
    base.panel.right.modal = offBlack1;
    base.modal.bd = base.bd;
    base.modal.bg = base.panel.right.modal;
    base.chatSummary["bg-selected"] = "rgb(24,24,24 / 40%)";
    base.chatSummary.hv = "rgb(24,24,24 / 80%)";
    base.chatSummary.del = base.button.bg;
    base.members.hv = base.chatSummary.hv;
    base.placeholder = txtLight;
    base.entry.input.bg = mattBlack;
    base.input.bg = mattBlack;
    base.chatSearch.bg = mattBlack;
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
    base.primary = white;
    base.link.underline = base.primary;
    base.scrollbar.bg = base.button.hv;
    base.toast.success.bg = base.notificationBar.bg;

    return base;
}

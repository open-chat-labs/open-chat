import type { MessageMenuAction } from "@client";
import type { MenuItem } from "@openchat/ui/src/lib/types";
import type { ChatMenuAction } from "@src/logic/chats/chatMenu";

// The web conversation's own props: its header's menu and a message's menu. Its messages are
// logic/conversation/messageRow's and its composer's props logic/composer/composerProps', which
// the native tree shows too.

// ── the header's menu ──

type HeaderMenuItem = MenuItem & { id: string };

const K = "ui.conversationHeader.menu.";
const icon = (name: string) => `var(--icon-${name}) center/contain no-repeat`;

export type HeaderMenuState = {
    kind: "user" | "group" | "channel";
    favourite: boolean;
    muted: boolean;
    everyoneMuted: boolean;
    /** A DM with a bot can't be muted. */
    isBot: boolean;
    /** There are unread messages to mark as read. */
    unread: boolean;
    /** Leave, delete, block and unblock, as logic/chats/chatMenu offers them. */
    actions: ChatMenuAction[];
    /** "Unblock user", which the library has no words for. */
    unblockLabel: string;
    /** Someone who can edit the group or channel: "Manage", else its details. */
    canEdit: boolean;
};

/**
 * ConversationHeader's menu, as the design's (`_chatMenu`): for a group or channel, Manage (or its
 * details), favourite, mute, @everyone, mark as read and copy link, then leave; for a DM,
 * favourite, mute, chat settings, then block and delete. Leave, delete, block and unblock show only where the
 * app allows them. Picking one reports its id (`onMenu`, or `onLeave`).
 */
export function headerMenuItems(state: HeaderMenuState): HeaderMenuItem[] {
    const group = state.kind !== "user";
    const noun = state.kind === "channel" ? "Channel" : "Group";
    const items: HeaderMenuItem[] = [];
    if (group) {
        items.push({
            id: "manage",
            label: K + (state.canEdit ? `manage${noun}` : `${noun.toLowerCase()}Details`),
            mask: icon(state.canEdit ? "gear" : "info"),
        });
    }
    items.push(
        state.favourite
            ? { id: "unfavourite", label: K + "removeFromFavourites", mask: icon("heart") }
            : { id: "favourite", label: K + "addToFavourites", mask: icon("heart") },
    );
    if (!state.isBot) {
        items.push(
            state.muted
                ? { id: "unmute", label: K + "unmuteNotifications", mask: icon("bell") }
                : { id: "mute", label: K + "muteNotifications", mask: icon("bell-off") },
        );
    }
    if (!group) {
        items.push({ id: "chatSettings", label: K + "chatSettings", mask: icon("gear") });
    }
    if (group) {
        items.push(
            state.everyoneMuted
                ? { id: "unmuteEveryone", label: K + "unmuteEveryone", mask: icon("at") }
                : { id: "muteEveryone", label: K + "muteEveryone", mask: icon("at") },
        );
        if (state.unread) {
            items.push({ id: "markRead", label: K + "markAsRead", mask: icon("check") });
        }
        items.push({ id: "copyUrl", label: K + "copyUrl", mask: icon("link") });
    }
    for (const action of state.actions) {
        items.push(actionItem(action, state));
    }
    return items;
}

/** The quick panel's menu: the header's without what the panel shows as buttons (favourite,
 *  mute, @everyone) or its own cog (Manage), as the design's `_panelMenu`. */
export function panelMenuItems(state: HeaderMenuState): HeaderMenuItem[] {
    const shown = new Set([
        "manage",
        "favourite",
        "unfavourite",
        "mute",
        "unmute",
        "muteEveryone",
        "unmuteEveryone",
    ]);
    return headerMenuItems(state).filter((item) => !shown.has(item.id));
}

function actionItem(action: ChatMenuAction, state: HeaderMenuState): HeaderMenuItem {
    switch (action) {
        case "leave":
            return {
                id: "leave",
                label: K + (state.kind === "channel" ? "leaveChannel" : "leaveGroup"),
                mask: icon("exit"),
                variant: "danger",
            };
        case "delete":
            return {
                id: "delete",
                label: K + "deleteChat",
                mask: icon("trash"),
                variant: "danger",
            };
        case "block":
            return { id: "block", label: K + "blockUser", mask: icon("ban"), variant: "danger" };
        case "unblock":
            return { id: "unblock", label: state.unblockLabel, mask: icon("ban") };
    }
}

/** One of a message's actions as MessageActions lists it; `label` is the app's resource key. */
export type MessageMenuItem =
    | { action: MessageMenuAction; label: string; mask: string; variant: "regular" | "danger" }
    | { action: "separator"; label: ""; variant: "separator" };

type MessageMenuEntry = { action: MessageMenuAction; label: string; icon: string };

// what a message's menu lists, in order: what's done with the message, then (after a separator)
// what acts on its sender or removes it
const MESSAGE_MENU: MessageMenuEntry[] = [
    { action: "reply", label: "quoteReply", icon: "reply" },
    { action: "start_thread", label: "thread.menu", icon: "threads" },
    { action: "follow_thread", label: "followThread", icon: "bell" },
    { action: "unfollow_thread", label: "unfollowThread", icon: "bell-off" },
    { action: "edit", label: "editMessage", icon: "edit" },
    { action: "forward", label: "forward", icon: "forward" },
    { action: "reply_privately", label: "replyPrivately", icon: "dm" },
    { action: "copy", label: "copy", icon: "copy" },
    { action: "copy_url", label: "copyMessageUrl", icon: "link" },
    { action: "share", label: "share", icon: "share" },
    { action: "translate", label: "translateMessage", icon: "lang" },
    { action: "untranslate", label: "untranslateMessage", icon: "lang" },
    { action: "pin", label: "pinMessage", icon: "pin" },
    { action: "unpin", label: "unpinMessage", icon: "pin" },
    { action: "remind", label: "reminders.menu", icon: "clock" },
    { action: "cancel_reminder", label: "reminders.cancel", icon: "clock" },
    { action: "retry", label: "retryMessage", icon: "refresh" },
    { action: "reveal", label: "revealDeletedMessage", icon: "eye" },
    { action: "undelete", label: "undeleteMessage", icon: "rotate-back" },
];

const MESSAGE_MENU_DANGER: MessageMenuEntry[] = [
    { action: "block_user", label: "blockUser", icon: "ban" },
    { action: "report", label: "report.menu", icon: "flag" },
    { action: "delete", label: "deleteMessage", icon: "trash" },
    { action: "delete_for_me", label: "deleteMessageForMe", icon: "trash" },
];

/**
 * A message's menu (MessageActions' items) for what it offers (`messageMenu`). Only the actions
 * this screen carries out are listed (a proposal's, tipping and the rest wait for theirs).
 */
export function messageMenuItems(actions: ReadonlySet<MessageMenuAction>): MessageMenuItem[] {
    const item =
        (variant: "regular" | "danger") =>
        (entry: MessageMenuEntry): MessageMenuItem => ({
            action: entry.action,
            label: entry.label,
            mask: `var(--icon-${entry.icon})`,
            variant,
        });
    const regular = MESSAGE_MENU.filter((e) => actions.has(e.action)).map(item("regular"));
    const danger = MESSAGE_MENU_DANGER.filter((e) => actions.has(e.action)).map(item("danger"));
    const separator: MessageMenuItem[] =
        regular.length > 0 && danger.length > 0
            ? [{ action: "separator", label: "", variant: "separator" }]
            : [];
    return [...regular, ...separator, ...danger];
}

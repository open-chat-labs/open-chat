import type { MessageMenuAction } from "@client";
import type { NativeMenuItem } from "@openchat/ui/src/native/types";

// A message's long-press menu (native design notes §3.3): what its menu offers (`messageMenu`,
// through `messageOffer`), in the design's order, with the design's icons, and Info, which every
// message there has but one that can't be acted on (deleted, blocked).

/** What a native message menu's rows do: one of the message's actions, or its info. */
export type NativeMessageAction = MessageMenuAction | "info";

type Entry = { id: NativeMessageAction; label: string; icon: string };

// the design's items first (Reply, Forward, Copy, Info, Edit), then the rest of what the old menus
// offered and the native tree carries out
const ITEMS: Entry[] = [
    { id: "reply", label: "reply", icon: "reply" },
    { id: "forward", label: "forward", icon: "forward" },
    { id: "copy", label: "copy", icon: "copy" },
    { id: "info", label: "native.conversation.message.info", icon: "info" },
    { id: "edit", label: "editMessage", icon: "edit" },
    { id: "reply_privately", label: "replyPrivately", icon: "dm" },
    { id: "translate", label: "translateMessage", icon: "lang" },
    { id: "untranslate", label: "untranslateMessage", icon: "lang" },
    { id: "pin", label: "pinMessage", icon: "pin" },
    { id: "unpin", label: "unpinMessage", icon: "pin" },
    { id: "copy_url", label: "native.conversation.message.copyLink", icon: "link" },
    { id: "share", label: "share", icon: "share" },
    { id: "cancel_reminder", label: "reminders.cancel", icon: "clock" },
    { id: "retry", label: "retryMessage", icon: "refresh" },
    { id: "reveal", label: "revealDeletedMessage", icon: "eye" },
    { id: "undelete", label: "undeleteMessage", icon: "rotate-back" },
];

// what removes the message or acts on its sender, after the one divider (notes §3.3)
const DANGER: Entry[] = [
    { id: "delete", label: "deleteMessage", icon: "trash" },
    { id: "delete_for_me", label: "deleteMessageForMe", icon: "trash" },
    { id: "report", label: "report.menu", icon: "flag" },
    { id: "block_user", label: "blockUser", icon: "ban" },
];

/**
 * A message's long-press menu rows for what it offers, with Info where it's `withInfo`, labelled by
 * `label` (the app's words for a resource key). Threads (N8a), reminders and tips aren't offered
 * here yet (GAPS.md, "Native conversation").
 */
export function messageMenuItems(
    actions: ReadonlySet<MessageMenuAction>,
    withInfo: boolean,
    label: (key: string) => string,
): NativeMenuItem[] {
    const offered = (e: Entry) => (e.id === "info" ? withInfo : actions.has(e.id));
    const regular = ITEMS.filter(offered).map(
        (e): NativeMenuItem => ({ id: e.id, label: label(e.label), icon: e.icon }),
    );
    const danger = DANGER.filter(offered).map(
        (e, i): NativeMenuItem => ({
            id: e.id,
            label: label(e.label),
            icon: e.icon,
            danger: true,
            separator: i === 0 && regular.length > 0,
        }),
    );
    return [...regular, ...danger];
}

/** What a picked row (by its id) does: one of the actions listed here, or nothing for another id. */
export function nativeMessageAction(id: string): NativeMessageAction | undefined {
    return [...ITEMS, ...DANGER].find((e) => e.id === id)?.id;
}

/** The quick reactions the bar offers: the user's most used first, then the usual ones, six in all. */
export const QUICK_REACTIONS = 6;
const USUAL = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function quickReactions(recent: readonly string[]): string[] {
    return [...new Set([...recent, ...USUAL])].slice(0, QUICK_REACTIONS);
}

/** The reader's own reactions on a message, by emoji. */
export function myReactions(
    reactions: readonly { reaction: string; userIds: ReadonlySet<string> }[],
    me: string,
): string[] {
    return reactions.filter((r) => r.userIds.has(me)).map((r) => r.reaction);
}

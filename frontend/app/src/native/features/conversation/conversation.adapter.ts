import type { NativeMenuItem } from "@openchat/ui/src/native/types";
import type { DisappearingSetting } from "@src/logic/chats/chatDisappearing.svelte";
import type { ChatMenuAction } from "@src/logic/chats/chatMenu";
import { disappearingChoicesWith } from "@src/logic/chats/disappearingMessages";
import type { CallState } from "@src/logic/conversation/callItem";

// The native conversation's own props (native design notes §3.3): its header's menu and its call
// items. Its messages are logic/conversation/messageRow's, as the web's are. The words come in from
// the screen (`label`), translated, as the kit shows its rows' labels as they are.

/** An item of the header's menu. */
export type HeaderMenuAction =
    | "search"
    | "details"
    | "mute"
    | "unmute"
    | "favourite"
    | "unfavourite"
    | "disappearing"
    | ChatMenuAction;

export type HeaderMenuState = {
    kind: "user" | "group" | "channel";
    muted: boolean;
    favourite: boolean;
    /** A DM with a bot can't be muted. */
    isBot: boolean;
    /** Leave, delete, block and unblock, as logic/chats/chatMenu offers them. */
    actions: ChatMenuAction[];
    /**
     * The chat's disappearing messages, for someone who may set them (`canSetDisappearing`): a
     * submenu of Off and the lengths. Without it, no item.
     */
    disappearing?: DisappearingSetting;
};

/** The disappearing submenu's words: Off, and a length ("8 hours") in the app's language. */
export type DisappearingWords = { off: string; duration: (id: string) => string };

// the disappearing submenu's rows: "disappearing:off", "disappearing:8 hours" …
const DISAPPEARING_ITEM = "disappearing:";

const ICONS: Record<HeaderMenuAction, string> = {
    search: "search",
    details: "info",
    mute: "bell-off",
    unmute: "bell",
    favourite: "heart",
    unfavourite: "heart",
    disappearing: "clock",
    leave: "exit",
    delete: "trash",
    block: "ban",
    unblock: "ban",
};

const DANGER: ReadonlySet<HeaderMenuAction> = new Set<HeaderMenuAction>([
    "leave",
    "delete",
    "block",
]);

/**
 * The header's kebab menu (native plan 04): Search in chat, the details, Mute (or Unmute), the
 * favourite, Disappearing messages (a submenu of Off and the lengths the details offer: one
 * setting with the details' switch), then, after a divider, leave, block or unblock, and delete,
 * as the app allows them.
 */
export function headerMenuItems(
    state: HeaderMenuState,
    label: (action: HeaderMenuAction) => string,
    words?: DisappearingWords,
): NativeMenuItem[] {
    const item = (id: HeaderMenuAction): NativeMenuItem => ({
        id,
        label: label(id),
        icon: ICONS[id],
        danger: DANGER.has(id) || undefined,
    });
    const items: NativeMenuItem[] = [item("search"), item("details")];
    if (!state.isBot) items.push(item(state.muted ? "unmute" : "mute"));
    items.push(item(state.favourite ? "unfavourite" : "favourite"));
    if (state.disappearing !== undefined && words !== undefined) {
        items.push({
            ...item("disappearing"),
            submenu: disappearingSubmenu(state.disappearing, label("disappearing"), words),
        });
    }
    state.actions.forEach((action, i) => {
        items.push({ ...item(action), separator: i === 0 || undefined });
    });
    return items;
}

/**
 * The disappearing submenu: Off, then the lengths (the usual ones, and the chat's own where it's
 * another), the current one ticked. `disappearingPick` reads its rows' ids back.
 */
export function disappearingSubmenu(
    setting: DisappearingSetting,
    title: string,
    words: DisappearingWords,
): { title: string; items: NativeMenuItem[] } {
    const lengths = disappearingChoicesWith(setting.on ? setting.after : "");
    return {
        title,
        items: [
            { id: `${DISAPPEARING_ITEM}off`, label: words.off, selected: !setting.on },
            ...lengths.map((id) => ({
                id: `${DISAPPEARING_ITEM}${id}`,
                label: words.duration(id),
                selected: setting.on && setting.after === id,
            })),
        ],
    };
}

/**
 * What a pick from the disappearing submenu sets: a length switches them on for it; Off switches
 * them off. None for another item, or for the setting they already have.
 */
export function disappearingPick(
    id: string,
    current: DisappearingSetting,
): DisappearingSetting | undefined {
    if (!id.startsWith(DISAPPEARING_ITEM)) return undefined;
    const picked = id.slice(DISAPPEARING_ITEM.length);
    const next: DisappearingSetting =
        picked === "off" ? { on: false, after: current.after } : { on: true, after: picked };
    const same = next.on === current.on && (!next.on || next.after === current.after);
    return same ? undefined : next;
}

/** CallEvent's props for an ended or missed call. */
export type CallEventProps = {
    state: "ended" | "missed";
    media: "video" | "voice";
    /** "You" is the library's word for the user's own call (no "from …" on a missed one). */
    startedBy: string;
    duration: string;
    time: string;
};

export function callEventProps(
    state: Exclude<CallState, "live">,
    media: "video" | "voice",
    startedBy: { mine: true } | { mine: false; name: string },
    duration: string,
    time: string,
): CallEventProps {
    return {
        state,
        media,
        startedBy: startedBy.mine ? "You" : startedBy.name,
        duration,
        time,
    };
}

/**
 * Whether the list shows its small spinner at the top (never one in the middle of the screen):
 * its first messages are on their way from the backend, none being in the cache. (A chat still
 * being selected, as a link opens a channel while its community loads, shows it in place of the
 * list.) A chat with nothing to load starts initialised, so its empty list shows none.
 */
export function listWaiting(list: { initialised: boolean; items: number }): boolean {
    return !list.initialised && list.items === 0;
}

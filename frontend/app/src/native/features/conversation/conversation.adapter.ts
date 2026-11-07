import type { NativeMenuItem } from "@openchat/ui/src/native/types";
import type { ChatMenuAction } from "@src/logic/chats/chatMenu";
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
    | ChatMenuAction;

export type HeaderMenuState = {
    kind: "user" | "group" | "channel";
    muted: boolean;
    favourite: boolean;
    /** A DM with a bot can't be muted. */
    isBot: boolean;
    /** Leave, delete, block and unblock, as logic/chats/chatMenu offers them. */
    actions: ChatMenuAction[];
};

const ICONS: Record<HeaderMenuAction, string> = {
    search: "search",
    details: "info",
    mute: "bell-off",
    unmute: "bell",
    favourite: "heart",
    unfavourite: "heart",
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
 * The header's kebab menu (notes §3.3): Search in chat, the details, Mute (or Unmute), the
 * favourite, then, after a divider, leave, block or unblock, and delete, as the app allows them.
 * A DM's disappearing messages are a switch on its details (N6), as in the current app, not here.
 */
export function headerMenuItems(
    state: HeaderMenuState,
    label: (action: HeaderMenuAction) => string,
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
    state.actions.forEach((action, i) => {
        items.push({ ...item(action), separator: i === 0 || undefined });
    });
    return items;
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

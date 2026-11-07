import type { NativeMenuItem } from "@openchat/ui/src/native/types";
import type { ChatMenuAction } from "@src/logic/chats/chatMenu";
import type { CallState } from "@src/logic/conversation/callItem";

// The native conversation's own props (native design notes §3.3): its header's menu and its call
// items. Its messages are logic/conversation/messageRow's, as the web's are. The words come in from
// the screen (`label`), translated, as the kit shows its rows' labels as they are.

/** How long a DM's messages last when they disappear (the prototype's choices), in ms; 0 is off. */
export const DISAPPEAR_AFTER = [
    { id: "off", ms: 0 },
    { id: "hour", ms: 60 * 60 * 1000 },
    { id: "day", ms: 24 * 60 * 60 * 1000 },
    { id: "week", ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

export type DisappearAfter = (typeof DISAPPEAR_AFTER)[number]["id"];

/** An item of the header's menu (`HeaderMenuAction`'s, or a disappearing-messages choice). */
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
    /** A DM with a bot can't be muted or set to disappear. */
    isBot: boolean;
    /** How long a DM's messages last (ms), if they disappear. */
    disappearAfter: number | undefined;
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

/** The id of a disappearing-messages choice in the menu. */
export function disappearItemId(after: DisappearAfter): string {
    return `disappear:${after}`;
}

/** The choice a menu item's id picks, if it's one. */
export function disappearChoice(id: string): (typeof DISAPPEAR_AFTER)[number] | undefined {
    return DISAPPEAR_AFTER.find((d) => disappearItemId(d.id) === id);
}

/**
 * The header's kebab menu (notes §3.3): Search in chat, the details, Mute (or Unmute), the
 * favourite, a DM's disappearing messages (a submenu of durations, the current one ticked), then,
 * after a divider, leave, block or unblock, and delete, as the app allows them.
 */
export function headerMenuItems(
    state: HeaderMenuState,
    label: (action: HeaderMenuAction | DisappearAfter) => string,
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
    if (state.kind === "user" && !state.isBot) {
        const current = state.disappearAfter ?? 0;
        items.push({
            ...item("disappearing"),
            submenu: {
                title: label("disappearing"),
                items: DISAPPEAR_AFTER.map((d) => ({
                    id: disappearItemId(d.id),
                    label: label(d.id),
                    selected: d.ms === current,
                })),
            },
        });
    }
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

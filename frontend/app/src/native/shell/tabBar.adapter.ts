import type { NativeTab } from "@openchat/ui/src/native/types";
import { NATIVE_TABS, type NativeTabId } from "../router/locations";

// The tab bar's tabs (TabBar): icon-only, each with its accessible name; the unread count on Chats,
// a dot on Activity, the user's photo on You when they have one (native design notes §1 Structure 1).

export type TabBarData = {
    /** Each tab's name, translated. */
    labels: Record<NativeTabId, string>;
    /** DMs and groups with unread messages, not muted. */
    chatsUnread: number;
    /** Unread activity. */
    activityUnread: boolean;
    /** The user's photo, if they have one. */
    photoUrl: string | undefined;
    /** Whether this build has the wallet (an app store build doesn't). */
    wallet: boolean;
};

const ICONS: Record<NativeTabId, string> = {
    chats: "chat",
    communities: "community",
    wallet: "wallet",
    activity: "bell",
    you: "user",
};

export function tabBarTabs(data: TabBarData): NativeTab[] {
    return NATIVE_TABS.filter((id) => id !== "wallet" || data.wallet).map((id) => ({
        id,
        label: data.labels[id],
        icon: ICONS[id],
        count: id === "chats" ? data.chatsUnread : undefined,
        dot: id === "activity" ? data.activityUnread : undefined,
        avatarUrl: id === "you" ? data.photoUrl : undefined,
    }));
}

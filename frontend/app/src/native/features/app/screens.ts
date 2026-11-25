import type { PendingToast, ToastUndo } from "@openchat/ui/src/native/toastQueue.svelte";
import type { PendingRemovals } from "@src/logic/chats/pendingRemovals.svelte";
import type { Component } from "svelte";
import type { LocalScreen, NativeScreen } from "../../router/locations";
import type { Overlays } from "../../shell/overlays.svelte";
import { disableWalletFeature } from "@src/utils/features";
import { ScreenModules } from "./screenModules";

// Which screen shows for each kind of native screen (router/locations.ts), a tab's root or one
// pushed. Each is its own chunk, loaded once (screenModules): the shell loads them all while it's
// idle, and a screen whose chunk isn't in yet keeps the one before it showing until it is.
//
// Every kind has an entry, undefined until its screen is built (a placeholder shows meanwhile), and
// the entries are kept apart by blank lines: issues adding different screens then change different
// lines, and don't conflict here (or in ScreenHost, which doesn't change).

/** What the shell gives every screen besides its own place. */
export type ScreenContext = {
    /** A pushed screen's Back (its header's back): none at a tab's root. */
    back: (() => void) | undefined;
    /** Where a screen registers an open sheet or menu, so Android's back closes it first. */
    overlays: Overlays;
    /** Pushes a screen that has no URL (New chat, a builder) over this one (TabStacks.push). */
    push: (screen: LocalScreen) => void;
    /**
     * Shows a toast (text, translated) in place of the one showing; with `undo`, it offers Undo,
     * which runs it (an operation of its own keeps the toast, waiting, then saying how it went) (a destructive action, notes §1 Sheets, menus, toasts). Returns what takes it
     * down early, as when its Undo can't work any more (and not a toast that has replaced it).
     */
    toast: (message: string, undo?: ToastUndo) => () => void;
    /**
     * Shows a toast in place of the one showing for an action still on its way (a block), with a
     * small loader in place of its buttons until it's settled: `done` (with Undo) or `failed`.
     */
    pendingToast: (message: string) => PendingToast;
    /**
     * Where toasts sit while this screen is on top, in CSS pixels from the window's bottom (a
     * footer that grows: a conversation's composer over the keyboard or a panel); undefined, where
     * they sit for its kind (`toastsAbove`). Its own, so a screen under the top one doesn't move
     * them (ToastFloors).
     */
    toastFloor: (px: number | undefined) => void;
    /**
     * Whether this screen is its tab's top one (reactive): false from the moment another is
     * pushed over it, and from the moment it's popped, while it slides out still mounted. Its own,
     * so a screen under the top one can leave Android's back to the one on top.
     */
    onTop: () => boolean;
    /**
     * Whether a tab's root takes the whole window for now, the tab bar sliding down out of the
     * way (the Chats tab's search). Its own, so another tab's root or a screen pushed over it
     * has the bar as its kind does (TabBarHides). A pushed screen has no bar to hide.
     */
    hideTabBar: (hidden: boolean) => void;
    /**
     * Leaves and deletes waiting out their Undo (the shell's, one for the app): opening the chat
     * by any way (search, New chat, a link) takes its wait back, and it lasts across tabs.
     */
    removals: PendingRemovals;
};

export type ScreenProps<S> = { screen: S; context: ScreenContext };

export type Loader<S> = () => Promise<{ default: Component<ScreenProps<S>> }>;

export type Screens = {
    [K in NativeScreen["kind"]]: Loader<Extract<NativeScreen, { kind: K }>> | undefined;
};

export const screens: Screens = {
    // the Chats tab: the list, search and New chat (N5a)
    chats: () => import("../chats/ChatsScreen.svelte"),

    // the Communities tab: a community's preview (N8b), the switcher and its channels (N8a)
    communities: () => import("../communities/CommunityScreen.svelte"),

    // the Wallet tab's root (N10a); none in an app store build, which never routes there
    // (locations.ts), so its chunk isn't built into one
    wallet: disableWalletFeature ? undefined : () => import("../wallet/WalletScreen.svelte"),

    // the Activity tab (N13)
    activity: () => import("../activity/ActivityScreen.svelte"),

    // the You tab (N12)
    you: () => import("../you/YouScreen.svelte"),

    // a conversation (N5b)
    conversation: () => import("../conversation/ConversationScreen.svelte"),

    // a thread (N8a): the conversation's screen, for the thread
    thread: () => import("../conversation/ConversationScreen.svelte"),

    // the followed threads (N8a)
    threads: () => import("../threads/ThreadsScreen.svelte"),

    // Explore (N8b)
    explore: () => import("../explore/ExploreScreen.svelte"),

    // an Explore shelf's View all (N8b)
    explore_list: () => import("../explore/ExploreListScreen.svelte"),

    // a token's page (N10a); none in an app store build, as the root
    token: disableWalletFeature ? undefined : () => import("../wallet/TokenScreen.svelte"),

    // Send, Receive and Swap (N10b)
    wallet_flow: undefined,

    // the saved recipients (N10b)
    recipients: undefined,

    // the platform operator console: none on native yet
    admin: undefined,

    // New chat, from the Chats tab's FAB (N5a)
    new_chat: () => import("../chats/NewChatScreen.svelte"),

    // New group, from the Chats tab's menu and New chat (N7)
    new_group: () => import("../groupSettings/NewGroupScreen.svelte"),

    // CHIT, from the Chats tab's header and the You tab's CHIT card (N11)
    chit: undefined,

    // Diamond, from the You tab (N12; buying it waits for N10b's PIN sheet)
    diamond: () => import("../you/DiamondScreen.svelte"),

    // Edit profile, from the You tab (N12)
    edit_profile: () => import("../you/EditProfileScreen.svelte"),

    // the You tab's settings pages (N12)
    settings: () => import("../you/SettingsScreen.svelte"),

    // Delete account, from You → Account (N12)
    delete_account: () => import("../you/DeleteAccountScreen.svelte"),

    // a DM's or group's details, from the conversation's header (N6)
    chat_details: () => import("../details/ChatDetailsScreen.svelte"),

    // a group's or channel's members, from its details (N6)
    chat_members: () => import("../details/MembersScreen.svelte"),

    // Invite people, from a group's or channel's details and its Members screen (N6)
    invite_people: () => import("../details/InvitePeopleScreen.svelte"),

    // a group's or channel's settings pages (edit, gates, rules, permissions, bots, stats), from
    // its details (N7)
    group_settings: () => import("../groupSettings/GroupSettingsScreen.svelte"),

    // Create group's gates, rules and permissions, from its Settings card (N7)
    new_group_settings: () => import("../groupSettings/NewGroupSettingsScreen.svelte"),

    // a builder from the conversation's attach panel: poll, prize, send crypto, swap offer, meme
    // fighter (N9)
    builder: undefined,

    // a message's info, from its long-press menu (N5d)
    message_info: () => import("../conversation/MessageInfoScreen.svelte"),

    // a group's or channel's pinned messages, from the conversation's pinned strip (plan 04)
    pinned_messages: () => import("../conversation/PinnedMessagesScreen.svelte"),

    // a community's details, from its page's header and Manage (N8a)
    community_details: () => import("../communities/CommunityDetailsScreen.svelte"),

    // a community's members, from its details (plan 10's Members screen)
    community_members: () => import("../communities/CommunityMembersScreen.svelte"),

    // a community's settings pages (edit, channels, user groups, invite, gates, rules, permissions,
    // bots, stats), from its details' Manage and Edit, and its page's menu (N7)
    community_settings: () => import("../communitySettings/CommunitySettingsScreen.svelte"),

    // Create community, from the Communities switcher's sheet (N8b)
    new_community: undefined,
};

/**
 * The screens' chunks, loaded once and kept. The Chats tab and a conversation are preloaded first
 * (a chat is what's opened most), then the other tabs' roots, then the rest.
 */
export const screenModules = new ScreenModules<
    NativeScreen["kind"],
    Component<ScreenProps<NativeScreen>>
>(
    // the entry for a kind takes that kind's screen
    screens as Partial<Record<NativeScreen["kind"], Loader<NativeScreen>>>,
    ["chats", "conversation", "you", "communities", "wallet", "activity"],
);

import type {
    ChannelIdentifier,
    ChatIdentifier,
    CommunityIdentifier,
    RouteParams,
} from "openchat-shared";
import { describe, expect, it } from "vitest";
import { navigationMode } from "./navigation";

// ---------------------------------------------------------------------------
// Route fixtures — only `kind` (and required discriminated-union fields) matter
// to navigationMode; other fields are set to minimal valid values.
// ---------------------------------------------------------------------------

const chats: RouteParams = { kind: "chat_list_route", scope: { kind: "none" } };
const notifications: RouteParams = { kind: "notifications_route", scope: { kind: "none" } };
const profile: RouteParams = { kind: "profile_summary_route", scope: { kind: "none" } };

const chatId: ChatIdentifier = { kind: "group_chat", groupId: "group_1" };
const communityId: CommunityIdentifier = { kind: "community", communityId: "comm_1" };
const channelId: ChannelIdentifier = { kind: "channel", communityId: "comm_1", channelId: 123 };

const chat: RouteParams = {
    kind: "global_chat_selected_route",
    chatType: "group_chat",
    chatId,
    open: false,
    scope: { kind: "none" },
};

const chatWithThread: RouteParams = {
    kind: "global_chat_selected_route",
    chatType: "group_chat",
    chatId,
    messageIndex: 42,
    threadMessageIndex: 7,
    open: true,
    scope: { kind: "none" },
};

const channel: RouteParams = {
    kind: "selected_channel_route",
    chatId: channelId,
    communityId,
    open: false,
    scope: { kind: "none" },
};

const channelWithThread: RouteParams = {
    kind: "selected_channel_route",
    chatId: channelId,
    communityId,
    messageIndex: 42,
    threadMessageIndex: 7,
    open: true,
    scope: { kind: "none" },
};

const notFound: RouteParams = { kind: "not_found_route", scope: { kind: "none" } };

// ---------------------------------------------------------------------------
// Real destination paths used in assertions
// ---------------------------------------------------------------------------

const P = {
    chats: "/chats",
    chatsRoot: "/",
    notifications: "/notifications",
    profile: "/profile_summary",
    group: "/group/group_1",
    groupMsg: "/group/group_1/42",
    groupThread: "/group/group_1/42/7",
    user: "/user/user_1",
    userThread: "/user/user_1/42/7",
    otherGroup: "/group/group_2",
    otherGroupThread: "/group/group_2/42/7",
    channel: "/community/comm_1/channel/chan_1",
    channelMsg: "/community/comm_1/channel/chan_1/42",
    channelThread: "/community/comm_1/channel/chan_1/42/7",
    otherChannel: "/community/comm_1/channel/chan_2",
    otherChannelThread: "/community/comm_1/channel/chan_2/42/7",
    favGroup: "/favourite/group/group_1",
    favGroupThread: "/favourite/group/group_1/42/7",
    favChannel: "/favourite/community/comm_1/channel/chan_1",
    favChannelThread: "/favourite/community/comm_1/channel/chan_1/42/7",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("navigationMode", () => {
    describe("notification intent", () => {
        it("always replaces regardless of from/to", () => {
            expect(navigationMode(P.chats, chats, "notification")).toBe("replace");
            expect(navigationMode(P.group, chats, "notification")).toBe("replace");
            expect(navigationMode(P.chats, chat, "notification")).toBe("replace");
            expect(navigationMode(P.group, chat, "notification")).toBe("replace");
            expect(navigationMode(P.groupThread, chat, "notification")).toBe("replace");
            expect(navigationMode(P.notifications, notifications, "notification")).toBe("replace");
        });
    });

    describe("tab → tab", () => {
        it("pushes when leaving the root tab", () => {
            expect(navigationMode(P.notifications, chats)).toBe("push");
            expect(navigationMode(P.profile, chats)).toBe("push");
        });

        it("pops when returning to the root tab from a non-root tab", () => {
            expect(navigationMode(P.chats, notifications)).toBe("pop");
            expect(navigationMode(P.chats, profile)).toBe("pop");
            expect(navigationMode(P.chatsRoot, notifications)).toBe("pop");
        });

        it("replaces when navigating between non-root tabs", () => {
            expect(navigationMode(P.profile, notifications)).toBe("replace");
            expect(navigationMode(P.notifications, profile)).toBe("replace");
        });

        it("replaces when navigating to the same tab", () => {
            expect(navigationMode(P.chats, chats)).toBe("replace");
            expect(navigationMode(P.notifications, notifications)).toBe("replace");
            expect(navigationMode(P.profile, profile)).toBe("replace");
        });
    });

    describe("tab → chat (going deeper)", () => {
        it("pushes when opening a group/direct chat from any tab", () => {
            expect(navigationMode(P.group, chats)).toBe("push");
            expect(navigationMode(P.user, chats)).toBe("push");
            expect(navigationMode(P.group, notifications)).toBe("push");
            expect(navigationMode(P.group, profile)).toBe("push");
        });

        it("pushes when opening a channel from any tab", () => {
            expect(navigationMode(P.channel, chats)).toBe("push");
            expect(navigationMode(P.channel, notifications)).toBe("push");
        });

        it("pushes when opening a chat with a message index", () => {
            expect(navigationMode(P.groupMsg, chats)).toBe("push");
            expect(navigationMode(P.channelMsg, notifications)).toBe("push");
        });
    });

    describe("chat → root tab", () => {
        it("pops when returning to chats from a group/direct chat", () => {
            expect(navigationMode(P.chats, chat)).toBe("pop");
            expect(navigationMode(P.chatsRoot, chat)).toBe("pop");
        });

        it("pops when returning to chats from a channel", () => {
            expect(navigationMode(P.chats, channel)).toBe("pop");
        });

        it("pops when returning to chats from a chat with an open thread", () => {
            expect(navigationMode(P.chats, chatWithThread)).toBe("pop");
            expect(navigationMode(P.chats, channelWithThread)).toBe("pop");
        });
    });

    describe("chat → non-root tab", () => {
        it("replaces when switching to a non-root tab from a chat", () => {
            expect(navigationMode(P.notifications, chat)).toBe("replace");
            expect(navigationMode(P.profile, chat)).toBe("replace");
            expect(navigationMode(P.notifications, channel)).toBe("replace");
        });

        it("replaces when switching to a non-root tab from a chat with a thread open", () => {
            expect(navigationMode(P.notifications, chatWithThread)).toBe("replace");
            expect(navigationMode(P.profile, channelWithThread)).toBe("replace");
        });
    });

    describe("thread opening (chat → same chat + thread)", () => {
        it("pushes when opening a thread in a group/direct chat", () => {
            expect(navigationMode(P.groupThread, chat)).toBe("push");
            expect(navigationMode(P.userThread, chat)).toBe("push");
        });

        it("pushes when opening a thread in a channel", () => {
            expect(navigationMode(P.channelThread, channel)).toBe("push");
        });

        it("pushes when opening a thread via favourites path", () => {
            expect(navigationMode(P.favGroupThread, chat)).toBe("push");
            expect(navigationMode(P.favChannelThread, channel)).toBe("push");
        });
    });

    describe("thread closing (chat + thread → same chat without thread)", () => {
        it("pops when closing a thread in a group/direct chat", () => {
            expect(navigationMode(P.group, chatWithThread)).toBe("pop");
            expect(navigationMode(P.groupMsg, chatWithThread)).toBe("pop");
        });

        it("pops when closing a thread in a channel", () => {
            expect(navigationMode(P.channel, channelWithThread)).toBe("pop");
            expect(navigationMode(P.channelMsg, channelWithThread)).toBe("pop");
        });
    });

    describe("thread → thread (switching threads or staying in thread)", () => {
        it("replaces when switching from one thread to another in the same chat", () => {
            expect(navigationMode(P.groupThread, chatWithThread)).toBe("replace");
        });

        it("replaces when switching threads across chats", () => {
            expect(navigationMode(P.otherGroupThread, chatWithThread)).toBe("replace");
            expect(navigationMode(P.otherChannelThread, channelWithThread)).toBe("replace");
        });
    });

    describe("chat → chat (lateral, no threads)", () => {
        it("replaces when switching between group/direct chats", () => {
            expect(navigationMode(P.otherGroup, chat)).toBe("replace");
            expect(navigationMode(P.user, chat)).toBe("replace");
        });

        it("replaces when switching between channels", () => {
            expect(navigationMode(P.otherChannel, channel)).toBe("replace");
        });

        it("replaces when navigating to the same chat", () => {
            expect(navigationMode(P.group, chat)).toBe("replace");
            expect(navigationMode(P.channel, channel)).toBe("replace");
        });

        it("replaces when navigating to a chat with a message index (no thread)", () => {
            expect(navigationMode(P.groupMsg, chat)).toBe("replace");
            expect(navigationMode(P.channelMsg, channel)).toBe("replace");
        });
    });

    describe("default intent", () => {
        it("defaults to in-app intent", () => {
            expect(navigationMode(P.group, chats)).toBe("push");
        });
    });

    describe("unknown / not_found_route", () => {
        it("replaces for all destinations from not_found_route", () => {
            expect(navigationMode(P.chats, notFound)).toBe("replace");
            expect(navigationMode(P.group, notFound)).toBe("replace");
            expect(navigationMode(P.notifications, notFound)).toBe("replace");
        });
    });
});

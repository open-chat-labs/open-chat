import { shareTargets, type ShareableChat } from "@client";
import { forwardRows } from "./forward.adapter";

const dm = (userId: string): ShareableChat => ({
    kind: "direct_chat",
    id: { kind: "direct_chat", userId },
    them: { userId },
});
const group = (groupId: string, name: string): ShareableChat => ({
    kind: "group_chat",
    id: { kind: "group_chat", groupId },
    name,
});
const channel = (communityId: string, channelId: number, name: string): ShareableChat => ({
    kind: "channel",
    id: { kind: "channel", communityId, channelId },
    name,
});

const targets = shareTargets<ShareableChat, { name: string; channels: ShareableChat[] }>({
    directChats: [dm("u1")],
    groupChats: [group("g1", "Rust fans")],
    communities: [{ name: "OpenChat", channels: [channel("c1", 7, "General")] }],
    isFavourite: (id) => id.kind === "group_chat",
    directChatName: () => ({ name: "Zoe", username: "zoe" }),
    canSendText: () => true,
    selectedChatId: undefined,
    excludeCurrent: true,
    search: "",
});

const sections = { favourites: "Favourites", directChats: "Direct chats", groupChats: "Groups" };

describe("the forward sheet's rows", () => {
    test("in every picker's sections, a favourite in its own section too", () => {
        const rows = forwardRows(targets, sections, () => "a group");
        expect(rows.map((r) => [r.section, r.name, r.sub, r.round])).toEqual([
            ["Favourites", "Rust fans", "a group", false],
            ["Direct chats", "Zoe", "@zoe", true],
            ["Groups", "Rust fans", "a group", false],
            ["OpenChat", "General", "a group", false],
        ]);
    });

    test("a chat listed twice is picked as one: the same id in both sections", () => {
        const rows = forwardRows(targets, sections, () => "");
        expect(rows[0].id).toBe(rows[2].id);
        expect(rows[0].chatId).toEqual({ kind: "group_chat", groupId: "g1" });
    });
});

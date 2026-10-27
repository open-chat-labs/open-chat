import { shareTargets, type ShareableChat } from "@client";
import { pickerChats, pickerIds, sharedLinkText } from "./share.adapter";

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

const text = {
    sections: { favourites: "Favourites", directChats: "Direct chats", groupChats: "Groups" },
    sub: (c: ShareableChat) => (c.kind === "direct_chat" ? "online" : "a group"),
};

describe("the chat picker's list", () => {
    test("is in sections: favourites, direct chats, groups, then each community's channels", () => {
        const list = pickerChats(targets, text);
        expect(list.map((c) => [c.group, c.name])).toEqual([
            ["Favourites", "Rust fans"],
            ["Direct chats", "Zoe"],
            ["Groups", "Rust fans"],
            ["OpenChat", "General"],
        ]);
        expect(list[1]).toMatchObject({ id: "u1", sub: "online", radius: "50%" });
        // the chat list's swatch for it
        expect(list[1].grad).toMatch(/^linear-gradient/);
        expect(list[3]).toMatchObject({ id: "c1_7", radius: "10px" });
    });

    test("finds the chat it passed back by its id", () => {
        const ids = pickerIds(targets);
        expect(ids.get("c1_7")).toEqual({ kind: "channel", communityId: "c1", channelId: 7 });
        expect(ids.get("nope")).toBeUndefined();
    });
});

describe("sharing a link to a chat", () => {
    test("sends the message, then the link on its own line, or just the link", () => {
        expect(sharedLinkText("Join us", "https://oc.app/x")).toBe("Join us\nhttps://oc.app/x");
        expect(sharedLinkText("  ", "https://oc.app/x")).toBe("https://oc.app/x");
    });
});

import type { MessageContent, MessageMenu, MessageMenuAction } from "@client";
import {
    messageMenuItems,
    myReactions,
    nativeMessageAction,
    nativeMessageOffer,
    quickReactions,
} from "./messageMenu.adapter";

const label = (key: string) => `t:${key}`;
const ids = (actions: MessageMenuAction[], info = true) =>
    messageMenuItems(new Set(actions), info, label).map((i) => i.id);

describe("a message's long-press menu", () => {
    test("a revealed deleted message's: Copy, Undelete and Hide, no Info (it's inert)", () => {
        const items = messageMenuItems(
            new Set(["undelete", "copy", "hide"] as const),
            false,
            label,
        );
        expect(items.map((i) => i.id)).toEqual(["copy", "undelete", "hide"]);
        expect(items.at(-1)).toEqual({
            id: "hide",
            label: "t:hideRevealedMessage",
            icon: "eye-off",
        });
        expect(nativeMessageAction("hide")).toBe("hide");
    });

    test("the design's items first, in its order, whatever order they're offered in", () => {
        expect(ids(["edit", "delete", "copy", "forward", "reply", "pin"])).toEqual([
            "reply",
            "forward",
            "copy",
            "info",
            "edit",
            "pin",
            "delete",
        ]);
    });

    test("one divider, above the first destructive item, which are in the danger colour", () => {
        const items = messageMenuItems(
            new Set<MessageMenuAction>(["reply", "report", "delete"]),
            true,
            label,
        );
        expect(items.map((i) => [i.id, !!i.separator, !!i.danger])).toEqual([
            ["reply", false, false],
            ["info", false, false],
            ["delete", true, true],
            ["report", false, true],
        ]);
    });

    test("no divider when only destructive items are offered", () => {
        const items = messageMenuItems(new Set<MessageMenuAction>(["delete"]), false, label);
        expect(items).toEqual([
            {
                id: "delete",
                label: "t:deleteMessage",
                icon: "trash",
                danger: true,
                separator: false,
            },
        ]);
    });

    test("Info only where it's given; threads, reminders and tips aren't listed", () => {
        expect(ids(["copy"], false)).toEqual(["copy"]);
        expect(ids(["start_thread", "follow_thread", "remind", "tip", "copy"])).toEqual([
            "copy",
            "info",
        ]);
    });
});

describe("a picked row", () => {
    test("does what its id says, and nothing for an id that isn't a row's", () => {
        expect(nativeMessageAction("info")).toBe("info");
        expect(nativeMessageAction("delete_for_me")).toBe("delete_for_me");
        expect(nativeMessageAction("start_thread")).toBeUndefined();
        expect(nativeMessageAction("nonsense")).toBeUndefined();
    });
});

describe("the reactions bar", () => {
    test("the user's most used first, then the usual ones, six in all, none twice", () => {
        expect(quickReactions(["🔥", "👍"])).toEqual(["🔥", "👍", "❤️", "😂", "😮", "😢"]);
        expect(quickReactions([])).toHaveLength(6);
    });

    test("the reader's own reactions are marked", () => {
        const reactions = [
            { reaction: "👍", userIds: new Set(["me", "them"]) },
            { reaction: "😂", userIds: new Set(["them"]) },
        ];
        expect(myReactions(reactions, "me")).toEqual(["👍"]);
    });
});

describe("what a message offers in the native conversation", () => {
    const offered: MessageMenu = {
        inert: true,
        menu: true,
        react: true,
        canEdit: false,
        canTip: false,
        actions: new Set<MessageMenuAction>(["reveal", "reply"]),
    };

    const deleted: MessageContent = { kind: "deleted_content", deletedBy: "me", timestamp: 1n };

    test("a placeholder you deleted offers Reveal alone, and no swipes or reactions", () => {
        // your own message, or someone else's you deleted as a moderator: messageMenu offers Reveal
        expect(nativeMessageOffer(offered, deleted)).toEqual({
            ...offered,
            menu: true,
            react: false,
            actions: new Set(["reveal"]),
        });
    });

    test("a placeholder without Reveal (someone else's deletion, or past its five minutes) has no menu", () => {
        const noMenu = { ...offered, menu: false, actions: new Set<MessageMenuAction>() };
        expect(nativeMessageOffer(noMenu, deleted)).toEqual({
            ...noMenu,
            react: false,
            actions: new Set(),
        });
        const noReveal = { ...offered, actions: new Set<MessageMenuAction>(["reply"]) };
        expect(nativeMessageOffer(noReveal, deleted)).toEqual({
            ...noReveal,
            menu: false,
            react: false,
            actions: new Set(),
        });
    });

    test("any other message offers what messageOffer says", () => {
        const text: MessageContent = { kind: "text_content", text: "hi" };
        expect(nativeMessageOffer(offered, text)).toBe(offered);
    });
});

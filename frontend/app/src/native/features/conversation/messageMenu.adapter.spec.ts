import type { MessageMenuAction } from "@client";
import {
    menuExit,
    messageMenuItems,
    myReactions,
    nativeMessageAction,
    quickReactions,
} from "./messageMenu.adapter";

const label = (key: string) => `t:${key}`;
const ids = (actions: MessageMenuAction[], info = true) =>
    messageMenuItems(new Set(actions), info, label).map((i) => i.id);

describe("a message's long-press menu", () => {
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

describe("where a picked row leaves the reader", () => {
    test("Info, and a private reply's DM, are other screens", () => {
        expect(menuExit("info", undefined)).toBe("away");
        expect(menuExit("reply_privately", "open_chat")).toBe("away");
    });

    test("everything else stays in the conversation, a sheet or a confirm over it included", () => {
        expect(menuExit("reply", "done")).toBe("conversation");
        expect(menuExit("edit", "done")).toBe("conversation");
        expect(menuExit("copy", "copied")).toBe("conversation");
        expect(menuExit("forward", "ask")).toBe("conversation");
        expect(menuExit("report", "ask")).toBe("conversation");
        expect(menuExit("delete", "ask")).toBe("conversation");
        expect(menuExit("translate", "upgrade")).toBe("conversation");
        expect(menuExit("pin", undefined)).toBe("conversation");
        expect(menuExit("reply_privately", "not_found")).toBe("conversation");
    });
});

import type { MessageMenuAction } from "@client";
import { messageMenuItems } from "./conversation.adapter";

describe("a message's menu", () => {
    const offers = (...actions: MessageMenuAction[]) => new Set<MessageMenuAction>(actions);

    test("lists what the message offers in the menu's order, with what removes it last, apart", () => {
        const items = messageMenuItems(
            offers("delete", "copy", "forward", "reply", "pin", "report", "remind", "block_user"),
        );
        expect(items.map((i) => i.action)).toEqual([
            "reply",
            "forward",
            "copy",
            "pin",
            "remind",
            "separator",
            "block_user",
            "report",
            "delete",
        ]);
        expect(items.find((i) => i.action === "delete")).toEqual({
            action: "delete",
            label: "deleteMessage",
            mask: "var(--icon-trash)",
            variant: "danger",
        });
    });

    test("has no separator when only one side has anything", () => {
        expect(messageMenuItems(offers("copy")).map((i) => i.action)).toEqual(["copy"]);
        expect(messageMenuItems(offers("delete_for_me")).map((i) => i.action)).toEqual([
            "delete_for_me",
        ]);
    });

    test("leaves out what this screen doesn't carry out", () => {
        expect(messageMenuItems(offers("tip", "collapse_proposal"))).toEqual([]);
    });

    test("offers a thread's items after Reply: start one, or follow or unfollow it", () => {
        expect(
            messageMenuItems(offers("copy", "start_thread", "reply")).map((i) => i.action),
        ).toEqual(["reply", "start_thread", "copy"]);
        expect(
            messageMenuItems(offers("unfollow_thread", "copy")).map((i) => [i.action, i.label]),
        ).toEqual([
            ["unfollow_thread", "unfollowThread"],
            ["copy", "copy"],
        ]);
    });
});

// a row's messages are kept between renders: a voice message's playback must stay live in them

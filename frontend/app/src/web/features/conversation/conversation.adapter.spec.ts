import type { MessageMenuAction } from "@client";
import {
    headerMenuItems,
    messageMenuItems,
    moderationMenuItems,
    type HeaderMenuState,
} from "./conversation.adapter";

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

describe("the header menu's moderator items", () => {
    const state = (moderation: HeaderMenuState["moderation"]): HeaderMenuState => ({
        kind: "group",
        favourite: false,
        muted: false,
        everyoneMuted: false,
        isBot: false,
        unread: false,
        actions: ["leave"],
        unblockLabel: "Unblock user",
        canEdit: false,
        moderation,
    });

    test("come last, after leave, with the app's words; freezing is a danger item", () => {
        const items = headerMenuItems(state([{ action: "freeze", label: "Freeze group" }]));
        expect(items.slice(-2).map((i) => i.id)).toEqual(["leave", "freeze"]);
        expect(items.at(-1)).toEqual({
            id: "freeze",
            label: "Freeze group",
            mask: "var(--icon-lock) center/contain no-repeat",
            variant: "danger",
        });
    });

    test("are all a preview's menu has, and none for anyone else", () => {
        expect(
            moderationMenuItems(state([{ action: "unfreeze", label: "Unfreeze group" }])).map(
                (i) => [i.id, i.variant],
            ),
        ).toEqual([["unfreeze", "regular"]]);
        expect(moderationMenuItems(state([]))).toEqual([]);
        expect(headerMenuItems(state([])).some((i) => i.id.includes("reeze"))).toBe(false);
    });
});

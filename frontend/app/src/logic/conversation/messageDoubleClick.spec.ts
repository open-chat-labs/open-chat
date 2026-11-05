import type { MessageMenuAction } from "@client";
import { messageDoubleClickAction } from "./messageDoubleClick";

const offers = (...actions: MessageMenuAction[]) => new Set<MessageMenuAction>(actions);

describe("double-clicking a message", () => {
    test("edits your own message and replies to someone else's", () => {
        const both = offers("edit", "reply");
        expect(messageDoubleClickAction(true, { mine: true, deleted: false }, both)).toBe("edit");
        expect(messageDoubleClickAction(true, { mine: false, deleted: false }, both)).toBe("reply");
    });

    test("does nothing with the setting off", () => {
        expect(
            messageDoubleClickAction(false, { mine: false, deleted: false }, offers("reply")),
        ).toBeUndefined();
    });

    test("does only what the message's menu offers", () => {
        // your own message that can't be edited isn't replied to instead
        expect(
            messageDoubleClickAction(true, { mine: true, deleted: false }, offers("reply")),
        ).toBeUndefined();
        // a failed or unconfirmed message offers neither
        expect(
            messageDoubleClickAction(true, { mine: false, deleted: false }, offers()),
        ).toBeUndefined();
    });

    test("does nothing on a deleted message, even one revealed", () => {
        expect(
            messageDoubleClickAction(true, { mine: false, deleted: true }, offers("reply")),
        ).toBeUndefined();
    });
});

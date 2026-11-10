import type { ChatIdentifier } from "@client";
import { ForwardPicks } from "./forwardPicks.svelte";

const a: ChatIdentifier = { kind: "group_chat", groupId: "a" };
const b: ChatIdentifier = { kind: "group_chat", groupId: "b" };

type Msg = { id: number };

function picking(message: Msg): ForwardPicks<Msg> {
    const picks = new ForwardPicks<Msg>();
    picks.show(message);
    picks.toggle("a", a);
    picks.toggle("b", b);
    picks.query = "gr";
    picks.note = "  look  ";
    return picks;
}

describe("the forward sheet's picks", () => {
    test("forwards to the chats in the order they were picked, the note trimmed", () => {
        const picks = picking({ id: 1 });
        expect(picks.picked()).toEqual({ chatIds: [a, b], note: "look" });
        picks.toggle("a", a);
        expect(picks.picked()).toEqual({ chatIds: [b], note: "look" });
        picks.toggle("b", b);
        expect(picks.picked()).toBeUndefined();
    });

    test("start afresh when the sheet opens again on the same message", () => {
        const message = { id: 1 };
        const picks = picking(message);
        picks.show(undefined);
        picks.show(message);
        expect(picks.count).toBe(0);
        expect(picks.isPicked("a")).toBe(false);
        expect(picks.query).toBe("");
        expect(picks.note).toBe("");
        expect(picks.picked()).toBeUndefined();
    });

    test("start afresh for another message", () => {
        const picks = picking({ id: 1 });
        picks.show({ id: 2 });
        expect(picks.count).toBe(0);
        expect(picks.note).toBe("");
    });

    test("are kept while the sheet stays open on its message", () => {
        const message = { id: 1 };
        const picks = picking(message);
        picks.show(message);
        expect(picks.picked()).toEqual({ chatIds: [a, b], note: "look" });
        expect(picks.query).toBe("gr");
    });
});

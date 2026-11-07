import { describe, expect, test } from "vitest";
import { MessageJumps } from "./messageJumps.svelte";

const chatId = { kind: "group_chat" as const, groupId: "g1" };

describe("MessageJumps", () => {
    test("a jump asked for is wanted until the conversation has gone there", () => {
        const jumps = new MessageJumps();
        jumps.ask(chatId, 5);
        const jump = jumps.wanted;
        expect(jump).toEqual({ chatId, messageIndex: 5 });
        jumps.done(jump!);
        expect(jumps.wanted).toBeUndefined();
    });

    test("asking for the same message again is a new jump", () => {
        const jumps = new MessageJumps();
        jumps.ask(chatId, 5);
        const first = jumps.wanted;
        jumps.ask(chatId, 5);
        expect(jumps.wanted).not.toBe(first);
    });

    test("finishing an older jump leaves a later one wanted", () => {
        const jumps = new MessageJumps();
        jumps.ask(chatId, 5);
        const older = jumps.wanted!;
        jumps.ask(chatId, 7);
        jumps.done(older);
        expect(jumps.wanted).toEqual({ chatId, messageIndex: 7 });
    });
});

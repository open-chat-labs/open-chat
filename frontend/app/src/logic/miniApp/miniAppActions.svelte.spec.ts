import type { MiniAppGame, MiniAppOutcome, ResourceKey } from "@client";
import { describe, expect, test } from "vitest";
import { MiniAppActions } from "./miniAppActions.svelte";

const GAME: MiniAppGame = {
    chatId: { kind: "group_chat", groupId: "group" },
    threadRootMessageIndex: undefined,
    messageId: 7n,
};
const FULL: ResourceKey = {
    kind: "resource_key",
    key: "bots.miniApp.refusals.full",
    lowercase: false,
};

describe("MiniAppActions", () => {
    test("is busy while a join's asked for, and keeps the reason it failed", async () => {
        let answer: (outcome: MiniAppOutcome) => void = () => undefined;
        const actions = new MiniAppActions(
            {
                joinMiniApp: () => new Promise((resolve) => (answer = resolve)),
                leaveMiniApp: async () => ({ kind: "success" }),
            },
            GAME,
        );

        const join = actions.join();
        expect(actions.busy).toBe("join");
        // one request at a time
        await actions.leave();
        expect(actions.busy).toBe("join");

        answer({ kind: "failed", message: FULL });
        await join;
        expect(actions.busy).toBeUndefined();
        expect(actions.error).toEqual(FULL);

        await actions.leave();
        expect(actions.error).toBeUndefined();
    });

    test("isn't left busy if a request throws", async () => {
        const actions = new MiniAppActions(
            {
                joinMiniApp: () => Promise.reject(new Error("oops")),
                leaveMiniApp: async () => ({ kind: "success" }),
            },
            GAME,
        );

        await expect(actions.join()).rejects.toThrow("oops");
        expect(actions.busy).toBeUndefined();
    });
});

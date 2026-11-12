import { i18nKey, type ChatIdentifier, type EventWrapper, type Message } from "@client";
import { ChatTurns, outlivesChatSwitch } from "./actionFollowUp";

describe("an action's follow-up after a chat switch", () => {
    test("an action's check holds while its chat shows, and not once another has taken its place", () => {
        const turns = new ChatTurns();
        const current = turns.start();
        expect(current()).toBe(true);
        turns.switched();
        expect(current()).toBe(false);
        // one started on the new chat holds
        const next = turns.start();
        expect(next()).toBe(true);
        expect(current()).toBe(false);
    });

    test("what opens over the conversation or leads away is dropped; what's said still shows", () => {
        const evt = {} as EventWrapper<Message>;
        const chatId = { kind: "group_chat", groupId: "g" } as ChatIdentifier;
        expect(outlivesChatSwitch({ kind: "ask", dialog: { kind: "forward", evt } })).toBe(false);
        expect(outlivesChatSwitch({ kind: "ask", dialog: { kind: "report", evt } })).toBe(false);
        expect(outlivesChatSwitch({ kind: "open_chat", chatId })).toBe(false);
        expect(outlivesChatSwitch({ kind: "upgrade" })).toBe(false);
        expect(outlivesChatSwitch({ kind: "open_thread", threadRootMessageIndex: 1 })).toBe(false);

        expect(outlivesChatSwitch({ kind: "done" })).toBe(true);
        expect(outlivesChatSwitch({ kind: "succeeded", message: i18nKey("x") })).toBe(true);
        expect(outlivesChatSwitch({ kind: "failed", message: i18nKey("x") })).toBe(true);
        expect(outlivesChatSwitch({ kind: "copied", ok: true })).toBe(true);
        expect(outlivesChatSwitch({ kind: "not_found" })).toBe(true);
    });
});

import type { ChatIdentifier, PinNumberResolver, RulesAcceptanceResolver } from "@shared";
import { describe, expect, test, vi } from "vitest";
import {
    declineOnChatChange,
    declinePrompt,
    declinesPrompt,
    PinAnswer,
    waitingPrompt,
} from "./pinPrompt";

function pinRequest() {
    const resolve = vi.fn<(pin: string) => void>();
    const reject = vi.fn<() => void>();
    const request: PinNumberResolver = { resolve, reject, message: undefined };
    return { request, resolve, reject };
}

describe("closing the PIN prompt rejects the waiting request; six digits resolve it exactly once", () => {
    test("closing rejects it, so nothing is sent", () => {
        const { request, resolve, reject } = pinRequest();
        new PinAnswer(request).close();
        expect(reject).toHaveBeenCalledTimes(1);
        expect(resolve).not.toHaveBeenCalled();
    });

    test("six digits resolve it once, and nothing after that answers it again", () => {
        const { request, resolve, reject } = pinRequest();
        const answer = new PinAnswer(request);
        expect(answer.enter("123456")).toBe(true);
        expect(answer.enter("123456")).toBe(false);
        answer.close();
        expect(resolve).toHaveBeenCalledTimes(1);
        expect(resolve).toHaveBeenCalledWith("123456");
        expect(reject).not.toHaveBeenCalled();
    });

    test("anything but six digits leaves it waiting", () => {
        const { request, resolve, reject } = pinRequest();
        const answer = new PinAnswer(request);
        expect(answer.enter("12345")).toBe(false);
        expect(answer.enter("12345a")).toBe(false);
        expect(answer.enter("1234567")).toBe(false);
        expect(resolve).not.toHaveBeenCalled();
        expect(reject).not.toHaveBeenCalled();
    });
});

describe("no PIN prompt shows while the rules prompt is waiting", () => {
    const rules: RulesAcceptanceResolver = { resolve: () => undefined };

    test("the rules come first, and the PIN prompt shows once they're answered", () => {
        const { request } = pinRequest();
        expect(waitingPrompt(rules, request)).toEqual({ kind: "rules", request: rules });
        expect(waitingPrompt(undefined, request)).toEqual({ kind: "pin", request });
        expect(waitingPrompt(undefined, undefined)).toEqual({ kind: "none" });
    });
});

describe("an open rules or PIN prompt is declined when the selected chat changes", () => {
    // the selected chat, as selectedChatIdStore gives it: the current one on subscribing
    function selectedChat(initial: ChatIdentifier | undefined) {
        let current = initial;
        const subscribers = new Set<(chat: ChatIdentifier | undefined) => void>();
        return {
            subscribe(fn: (chat: ChatIdentifier | undefined) => void) {
                subscribers.add(fn);
                fn(current);
                return () => {
                    subscribers.delete(fn);
                };
            },
            select(chat: ChatIdentifier | undefined) {
                current = chat;
                subscribers.forEach((fn) => fn(chat));
            },
        };
    }
    const chat = (groupId: string): ChatIdentifier => ({ kind: "group_chat", groupId });

    test("another chat declines the rules prompt once, unaccepted", () => {
        const resolve = vi.fn<(accepted: boolean) => void>();
        const chats = selectedChat(chat("a"));
        declineOnChatChange(chats, () => declinePrompt({ kind: "rules", request: { resolve } }));
        chats.select(chat("b"));
        chats.select(chat("c"));
        expect(resolve).toHaveBeenCalledTimes(1);
        expect(resolve).toHaveBeenCalledWith(false);
    });

    test("another chat, or leaving the chat, declines the PIN prompt once", () => {
        const { request, resolve, reject } = pinRequest();
        const chats = selectedChat(chat("a"));
        declineOnChatChange(chats, () => declinePrompt({ kind: "pin", request }));
        chats.select(undefined);
        expect(reject).toHaveBeenCalledTimes(1);
        chats.select(chat("b"));
        expect(reject).toHaveBeenCalledTimes(1);
        expect(resolve).not.toHaveBeenCalled();
    });

    test("a navigation within the same chat (a thread, a query) keeps it open", () => {
        const decline = vi.fn();
        const chats = selectedChat(chat("a"));
        declineOnChatChange(chats, decline);
        // the route gives a new identifier for the same chat
        chats.select(chat("a"));
        expect(decline).not.toHaveBeenCalled();
        // a prompt opened outside any chat stays open while none is selected
        expect(declinesPrompt(undefined, undefined)).toBe(false);
    });

    test("once the prompt is answered (unsubscribed), a chat change does nothing", () => {
        const decline = vi.fn();
        const chats = selectedChat(chat("a"));
        const stop = declineOnChatChange(chats, decline);
        stop();
        chats.select(chat("b"));
        expect(decline).not.toHaveBeenCalled();
    });
});

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// A store the client builds at import time reads the screen width through
// matchMedia, which jsdom does not provide
vi.hoisted(() => {
    window.matchMedia = ((query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            onchange: null,
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

// The constructor starts an auth client against IndexedDB; keep it inert
vi.mock("@icp-sdk/auth/client", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    AuthClient: { create: () => new Promise(() => {}) },
}));

import {
    ChatMap,
    anonymousUser,
    type CommandDefinition,
    type DirectChatIdentifier,
    type DirectChatSummary,
    type ExternalBot,
    type UserSummary,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore, localUpdates, serverDirectChatsStore } from "./state";
import { botState } from "./state/bots.svelte";
import { userStore } from "./state/users/state";
import { WorkerAgent } from "./workerAgent";

// What the user types in a direct chat with a bot goes to the bot as its direct-message command,
// and shows in the chat as the user's message.

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

function config(): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
        proposalBotCanister: "aaaaa-aa",
    } as unknown as OpenChatConfig;
}

const chatId: DirectChatIdentifier = { kind: "direct_chat", userId: "bot" };
const context = { chatId };

function command(directMessages: boolean): CommandDefinition {
    return {
        name: "ask",
        params: [{ kind: "string", name: "prompt", required: true }],
        directMessages,
    } as unknown as CommandDefinition;
}

function bot(directMessages: boolean): ExternalBot {
    return {
        kind: "external_bot",
        id: "bot",
        endpoint: "https://bot",
        definition: { commands: [command(directMessages)] },
    } as unknown as ExternalBot;
}

describe("sending to a bot in a direct chat", () => {
    let client: OpenChat;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(
            (() => new Promise(() => {})) as never,
        );
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        userStore.addMany([{ kind: "bot", userId: "bot", username: "bot" } as UserSummary]);
        const directs = new ChatMap<DirectChatSummary>();
        directs.set(chatId, {
            kind: "direct_chat",
            id: chatId,
            them: chatId,
        } as unknown as DirectChatSummary);
        serverDirectChatsStore.set(directs);
        localUpdates.draftMessages.setTextContent(context, "hello");
        client = new OpenChat(config());
        vi.spyOn(client, "executeBotCommand").mockResolvedValue("success");
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        botState.setExternalBots([]);
        currentUserStore.set(anonymousUser());
        serverDirectChatsStore.set(new ChatMap());
        localUpdates.draftMessages.delete(context);
        localUpdates.clearAll();
    });

    /** Invariant 1: the text shows as the user's message, and goes to the bot as the argument of
     * its direct-message command, for that same message; the draft is cleared. */
    test("goes to the bot as its direct-message command", () => {
        botState.setExternalBots([bot(true)]);

        expect(client.sendDirectBotMessage(context, "hello", false)).toEqual({ kind: "sent" });

        const [shown] = localUpdates.unconfirmedMessages(context);
        expect(shown.event.sender).toBe("me");
        expect(shown.event.content).toEqual({ kind: "text_content", text: "hello" });
        const [scope, instance, direct] = vi.mocked(client.executeBotCommand).mock.calls[0];
        expect(scope).toMatchObject({ chatId, userMessageId: shown.event.messageId });
        expect(instance).toMatchObject({
            id: "bot",
            command: { name: "ask", arguments: [{ name: "prompt", value: "hello" }] },
        });
        expect(direct).toBe(true);
        expect(localUpdates.draftMessages.value.get(context)).toBeUndefined();
    });

    /** Invariant 2: a bot that takes no direct messages gets nothing, nothing shows, and the draft
     * is kept. */
    test("a bot without a direct-message command gets nothing", () => {
        botState.setExternalBots([bot(false)]);

        expect(client.sendDirectBotMessage(context, "hello", false)).toEqual({
            kind: "no_direct_command",
        });

        expect(localUpdates.unconfirmedMessages(context)).toHaveLength(0);
        expect(client.executeBotCommand).not.toHaveBeenCalled();
        expect(localUpdates.draftMessages.value.get(context)?.textContent).toBe("hello");
    });
});

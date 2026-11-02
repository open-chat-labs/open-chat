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
    anonymousUser,
    type BotActionScope,
    type BotCommandInstance,
    type BotCommandResponse,
    type ChatSummary,
    type GroupChatIdentifier,
    type MessageContent,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore, localUpdates } from "./state";
import { WorkerAgent } from "./workerAgent";

// A command's placeholder shows until the bot answers, then the answer's message shows in its place
// until the message itself comes from the chat.

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

const chatId: GroupChatIdentifier = { kind: "group_chat", groupId: "group" };
const context = { chatId };
const messageId = 7n;
const scope: BotActionScope = {
    kind: "chat_scope",
    chatId,
    threadRootMessageIndex: undefined,
    messageId,
};

const instance = {
    kind: "external_bot",
    id: "bot",
    endpoint: "https://bot",
    command: { name: "play", arguments: [], placeholder: "Setting up the game ..." },
} as unknown as BotCommandInstance;

const card: MessageContent = { kind: "text_content", text: "The game's card" };

describe("a command's answer", () => {
    let client: OpenChat;
    let answer: (response: BotCommandResponse) => void;
    let tokenGiven: Promise<void>;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        let tokenWasGiven: () => void;
        tokenGiven = new Promise((resolve) => (tokenWasGiven = resolve));
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: { kind: string }) => {
            switch (req.kind) {
                case "getAccessToken":
                    tokenWasGiven();
                    return Promise.resolve("token");
                case "callBotCommandEndpoint":
                    return new Promise((resolve) => (answer = resolve));
                default:
                    return new Promise(() => {});
            }
        }) as never);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        client = new OpenChat(config());
        vi.spyOn(client, "lookupChatSummary").mockReturnValue({
            kind: "group_chat",
            id: chatId,
            localUserIndex: "lui",
        } as unknown as ChatSummary);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        localUpdates.clearAll();
    });

    /** Runs the command until it's waiting for the bot's answer, giving its outcome to come */
    async function run(): Promise<{ outcome: Promise<string> }> {
        const outcome = client.executeBotCommand(scope, instance);
        await tokenGiven;
        // the placeholder's added once the token's back
        await vi.waitFor(() => expect(localUpdates.unconfirmedMessages(context)).toHaveLength(1));
        return { outcome };
    }

    function answerWithCard(id: bigint = messageId) {
        answer({
            kind: "success",
            message: {
                messageId: id,
                messageContent: card,
                finalised: true,
                blockLevelMarkdown: false,
                ephemeral: false,
            },
        });
    }

    test("takes the placeholder's place until the message comes", async () => {
        const { outcome } = await run();
        expect(localUpdates.unconfirmedMessages(context)[0].event.content).toEqual({
            kind: "text_content",
            text: "Setting up the game ...",
        });

        answerWithCard();

        expect(await outcome).toBe("success");
        const shown = localUpdates.unconfirmedMessages(context);
        expect(shown).toHaveLength(1);
        expect(shown[0].event.messageId).toBe(messageId);
        expect(shown[0].event.content).toEqual(card);
    });

    test("isn't shown once the message has come, as it would be added again", async () => {
        const { outcome } = await run();
        // A chat update brings the bot's message before the bot answers, which removes the
        // placeholder, as the client does when it confirms a message
        localUpdates.deleteUnconfirmed(context, messageId);

        answerWithCard();

        expect(await outcome).toBe("success");
        expect(localUpdates.unconfirmedMessages(context)).toHaveLength(0);
    });

    test("for another message is shown, whether or not the placeholder's gone", async () => {
        const { outcome } = await run();
        localUpdates.deleteUnconfirmed(context, messageId);

        answerWithCard(8n);

        expect(await outcome).toBe("success");
        const shown = localUpdates.unconfirmedMessages(context);
        expect(shown).toHaveLength(1);
        expect(shown[0].event.messageId).toBe(8n);
    });
});

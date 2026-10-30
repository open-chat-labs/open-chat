import { beforeEach, describe, expect, test, vi } from "vitest";

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

import type { UserSummary, WebhookDetails } from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { userStore } from "./state/users/state";

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
        i18nFormatter: (key: string) => key,
    } as unknown as OpenChatConfig;
}

const user = { kind: "user", userId: "user", username: "alice" } as unknown as UserSummary;
const webhook = { id: "live", name: "Relay" } as unknown as WebhookDetails;
const webhooks = new Map([[webhook.id, webhook]]);

describe("the display name of a message's sender", () => {
    let client: OpenChat;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        client = new OpenChat(config());
        userStore.addUser(user);
        // Both webhooks have sent messages in the chat, but only `live` is still one of its webhooks
        userStore.addWebhookIds(["live", "gone"]);
    });

    test("a user is named by their username", () => {
        expect(client.getDisplayName("user", undefined, webhooks)).toBe("alice");
    });

    test("a webhook the chat still has is named", () => {
        expect(client.getDisplayName("live", undefined, webhooks)).toBe("Relay");
    });

    test("a webhook the chat no longer has is shown as deleted", () => {
        expect(client.getDisplayName("gone", undefined, webhooks)).toBe("deletedWebhook");
    });

    test("without the chat's webhooks a webhook can't be told from an unknown user", () => {
        expect(client.getDisplayName("gone")).toBe("unknownUser");
    });

    test("an id which is neither a user nor a webhook is unknown", () => {
        expect(client.getDisplayName("nobody", undefined, webhooks)).toBe("unknownUser");
    });
});

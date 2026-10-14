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
    defaultChatRules,
    type CommunityAndRules,
    type CommunitySummary,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore } from "./state";
import { WorkerAgent } from "./workerAgent";
import en from "../../app/src/i18n/en.json";

// The English text for a message key, so a test can tell a real message from a missing key
function english(key: string): unknown {
    return key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], en);
}

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

function community(overrides: Partial<CommunitySummary> = {}): CommunityAndRules {
    return {
        community: {
            kind: "community",
            id: { kind: "community", communityId: "rrkah-fqaaa-aaaaa-aaaaq-cai" },
            name: "Community",
            description: "",
            avatar: {},
            banner: {},
            gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
            public: true,
            permissions: {
                changeRoles: "admin",
                updateDetails: "admin",
                inviteUsers: "admin",
                removeMembers: "moderator",
                createPublicChannel: "admin",
                createPrivateChannel: "admin",
                manageUserGroups: "admin",
            },
            primaryLanguage: "en",
            verified: false,
            channels: [],
            ...overrides,
        } as CommunitySummary,
        rules: { ...defaultChatRules("community"), newVersion: false },
    };
}

describe("editing and creating a community", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];
    let invited: boolean;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        client = new OpenChat(config());
        sent = [];
        invited = true;
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            switch (req.kind) {
                case "updateCommunity":
                    return Promise.resolve({ kind: "success", rulesVersion: undefined });
                case "createCommunity":
                    return Promise.resolve({
                        kind: "success",
                        id: "rrkah-fqaaa-aaaaa-aaaaq-cai",
                        channels: [],
                    });
                case "inviteUsers":
                    return Promise.resolve(invited);
                default:
                    return new Promise(() => {});
            }
        }) as never);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
    });

    function updatesSent() {
        return sent.filter((r) => r.kind === "updateCommunity");
    }

    // Invariant: an edit sends exactly the fields the user changed, whichever they are
    test("a change to only the banner or only the language is sent, and nothing else", async () => {
        const original = community();
        const banner = { blobUrl: "blob:new", blobData: new Uint8Array([1]) };
        expect(await client.updateCommunity(original, community({ banner }))).toEqual({
            kind: "success",
        });
        expect(
            await client.updateCommunity(original, community({ primaryLanguage: "fr" })),
        ).toEqual({ kind: "success" });

        const changed = updatesSent().map((r) =>
            Object.keys(r).filter((k) => r[k as keyof typeof r] !== undefined),
        );
        expect(changed).toEqual([
            ["kind", "communityId", "banner"],
            ["kind", "communityId", "primaryLanguage"],
        ]);
    });

    test("a community with no changes sends nothing", async () => {
        expect(await client.updateCommunity(community(), community())).toEqual({
            kind: "unchanged",
        });
        expect(sent).toEqual([]);
    });

    // Invariant: a verified community is only renamed, losing its verification, once the user confirms
    test("renaming a verified community sends nothing until the user confirms", async () => {
        const verified = community({ verified: true });
        const renamed = community({ verified: true, name: "Renamed" });

        expect(await client.updateCommunity(verified, renamed)).toEqual({
            kind: "needs_confirmation",
            confirmation: "verified_name",
        });
        expect(sent).toEqual([]);

        await client.updateCommunity(verified, renamed, ["verified_name"]);
        expect(updatesSent()).toEqual([expect.objectContaining({ name: "Renamed" })]);
    });

    // Invariant: a community is only made private once the user confirms. Making one public needs no
    // confirmation.
    test("making a community private sends nothing until the user confirms", async () => {
        const madePrivate = community({ public: false });

        expect(await client.updateCommunity(community(), madePrivate)).toEqual({
            kind: "needs_confirmation",
            confirmation: "visibility",
        });
        expect(sent).toEqual([]);

        expect(await client.updateCommunity(madePrivate, community())).toEqual({
            kind: "success",
        });
        expect(updatesSent()).toEqual([expect.objectContaining({ isPublic: true })]);
    });

    // Invariant: a new community whose invites fail still opens, and the user is told the invites
    // failed. Both trees dropped the failure.
    test("a new community whose invites fail is created and says the invites failed", async () => {
        invited = false;

        const outcome = await client.createCommunity(community(), ["General"], ["u1"]);
        expect(outcome).toEqual({
            kind: "created_without_invites",
            id: { kind: "community", communityId: "rrkah-fqaaa-aaaaa-aaaaq-cai" },
            message: expect.anything(),
        });
        if (outcome.kind === "created_without_invites") {
            expect(english(outcome.message.key)).toEqual(expect.any(String));
        }
    });
});

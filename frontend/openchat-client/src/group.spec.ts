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
    type CandidateGroupChat,
    type GroupChatIdentifier,
    type GroupChatSummary,
    type UpdateGroupResponse,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore } from "./state";
import { groupUpdateResult } from "./utils/group.svelte";
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

describe("editing and creating a group", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];
    let invited: boolean;
    let original: CandidateGroupChat;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        client = new OpenChat(config());
        sent = [];
        invited = true;
        original = {
            ...client.createCandidateGroup("group", false)!,
            id: { kind: "group_chat", groupId: "rrkah-fqaaa-aaaaa-aaaaq-cai" },
            name: "Group",
        };
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            switch (req.kind) {
                case "updateGroup":
                    return Promise.resolve({ kind: "success", rulesVersion: undefined });
                case "createGroupChat":
                    return Promise.resolve({ kind: "success", canisterId: original.id });
                case "inviteUsers":
                    return Promise.resolve(invited);
                case "addMembersToChannel":
                    return Promise.resolve({ kind: "success" });
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
        return sent.filter((r) => r.kind === "updateGroup");
    }

    // Invariant: an edit sends exactly the fields the user changed, whichever they are. Mobile could
    // not save a change to only the avatar or only the external URL.
    test("a change to only the avatar or only the URL is sent, and nothing else", async () => {
        const avatar = { blobUrl: "blob:new", blobData: new Uint8Array([1]) };
        expect(await client.updateGroup(original, { ...original, avatar })).toEqual({
            kind: "success",
        });
        expect(
            await client.updateGroup(original, { ...original, externalUrl: "https://oc.app" }),
        ).toEqual({ kind: "success" });

        const changed = updatesSent().map((r) =>
            Object.keys(r).filter((k) => r[k as keyof typeof r] !== undefined),
        );
        expect(changed).toEqual([
            ["kind", "chatId", "avatar"],
            ["kind", "chatId", "externalUrl"],
        ]);
    });

    test("a group with no changes sends nothing", async () => {
        expect(await client.updateGroup(original, structuredClone(original))).toEqual({
            kind: "unchanged",
        });
        expect(sent).toEqual([]);
    });

    // Invariant: a verified group is only renamed, losing its verification, once the user confirms
    test("renaming a verified group sends nothing until the user confirms", async () => {
        const verified = { ...original, verified: true };
        const renamed = { ...verified, name: "Renamed" };

        expect(await client.updateGroup(verified, renamed)).toEqual({
            kind: "needs_confirmation",
            confirmation: "verified_name",
        });
        expect(sent).toEqual([]);

        expect(await client.updateGroup(verified, renamed, ["verified_name"])).toEqual({
            kind: "success",
        });
        expect(updatesSent()).toEqual([expect.objectContaining({ name: "Renamed" })]);
    });

    // Invariant: a group is only made public or private once the user confirms
    test("making a group public sends nothing until the user confirms", async () => {
        const madePublic = { ...original, public: true };

        expect(await client.updateGroup(original, madePublic)).toEqual({
            kind: "needs_confirmation",
            confirmation: "visibility",
        });
        expect(sent).toEqual([]);

        await client.updateGroup(original, madePublic, ["visibility"]);
        expect(updatesSent()).toEqual([expect.objectContaining({ isPublic: true })]);
    });

    // Invariant: a new group whose invites fail still opens, and the user is told the invites failed.
    // Both trees dropped the failure.
    test("a new group whose invites fail is created and says the invites failed", async () => {
        invited = false;

        const outcome = await client.createGroup(original, ["u1"]);
        expect(outcome).toEqual({
            kind: "created_without_invites",
            chatId: original.id,
            message: expect.anything(),
        });
        if (outcome.kind === "created_without_invites") {
            expect(english(outcome.message.key)).toEqual(expect.any(String));
        }
    });

    // 4b: a new channel's community members picked to join are added, not invited, and people
    // from outside the community are invited
    test("a new channel adds the members picked and invites the others", async () => {
        const channel = {
            ...original,
            id: { kind: "channel" as const, communityId: "c", channelId: 7 },
            level: "channel" as const,
        };
        let added: unknown = { kind: "success" };
        vi.mocked(WorkerAgent.prototype.send).mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            switch (req.kind) {
                case "createGroupChat":
                    return Promise.resolve({ kind: "success", canisterId: channel.id });
                case "inviteUsers":
                    return Promise.resolve(true);
                case "addMembersToChannel":
                    return Promise.resolve(added);
                default:
                    return new Promise(() => {});
            }
        }) as never);

        expect(await client.createGroup(channel, ["outsider"], ["member"])).toEqual({
            kind: "created",
            chatId: channel.id,
        });
        expect(sent).toContainEqual(
            expect.objectContaining({ kind: "addMembersToChannel", userIds: ["member"] }),
        );
        expect(sent).toContainEqual(
            expect.objectContaining({ kind: "inviteUsers", userIds: ["outsider"] }),
        );

        // created all the same, and says the members weren't added
        added = { kind: "add_to_channel_failed" };
        expect(await client.createGroup(channel, [], ["member"])).toEqual({
            kind: "created_without_invites",
            chatId: channel.id,
            message: expect.anything(),
        });
    });

    // 4b invariant 3: a failed convert or import maps to a message, and a success to its channel
    test("a convert or import says what became of the group", async () => {
        const group = { ...original, kind: "group_chat" } as unknown as GroupChatSummary;
        const community = { kind: "community" as const, communityId: "c" };
        const channelId = { kind: "channel" as const, communityId: "c", channelId: 3 };
        let ok = false;
        vi.mocked(WorkerAgent.prototype.send).mockImplementation(((req: WorkerRequest) =>
            req.kind === "convertGroupToCommunity"
                ? Promise.resolve(ok ? { kind: "success", id: channelId } : { kind: "error" })
                : req.kind === "importGroupToCommunity"
                  ? ok
                      ? Promise.resolve({ kind: "success", channelId })
                      : Promise.reject(new Error("offline"))
                  : new Promise(() => {})) as never);

        for (const outcome of [
            await client.convertGroupToCommunity(group, defaultChatRules("community")),
            await client.importToCommunity(group.id as GroupChatIdentifier, community),
        ]) {
            expect(outcome.kind).toBe("failed");
            if (outcome.kind === "failed") {
                expect(english(outcome.message.key)).toEqual(expect.any(String));
            }
        }

        ok = true;
        expect(await client.convertGroupToCommunity(group, defaultChatRules("community"))).toEqual({
            kind: "success",
            channelId,
        });
        expect(await client.importToCommunity(group.id as GroupChatIdentifier, community)).toEqual({
            kind: "success",
            channelId,
        });
    });

    // a failed save showed the bare key "failure", which has no words
    test("a failed update says so in words", () => {
        for (const kind of ["failure", "error"] as const) {
            const outcome = groupUpdateResult({ kind } as UpdateGroupResponse, "group");
            expect(outcome.kind).toBe("failed");
            if (outcome.kind === "failed") {
                expect(english(outcome.message.key)).toEqual(expect.any(String));
            }
        }
    });
});

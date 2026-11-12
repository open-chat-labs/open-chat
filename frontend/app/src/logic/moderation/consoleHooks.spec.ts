import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
    installConsoleHooks,
    platformModeratorHooks,
    platformOperatorHooks,
    type ConsoleHooksClient,
    type ConsoleHooksHost,
} from "./consoleHooks";

function fakeClient(answer = true) {
    const ok = () => vi.fn(() => Promise.resolve(answer));
    return {
        addHotGroupExclusion: ok(),
        deleteFrozenGroup: ok(),
        deleteMessage: ok(),
        freezeGroup: ok(),
        removeHotGroupExclusion: ok(),
        setCommunityModerationFlags: ok(),
        setGroupModerationFlags: ok(),
        unfreezeGroup: ok(),
        addMessageFilter: ok(),
        removeMessageFilter: ok(),
        reportedMessages: vi.fn(() => Promise.resolve('{"reports":[1]}')),
        unsuspendUser: ok(),
        addRemoveSwapProvider: ok(),
        setGroupUpgradeConcurrency: ok(),
        setCommunityUpgradeConcurrency: ok(),
        markLocalGroupIndexFull: ok(),
        reinstateMissedDailyClaims: ok(),
        setAirdropConfig: ok(),
        setDiamondMembershipFees: ok(),
        setTokenEnabled: ok(),
        stakeNeuronForSubmittingProposals: ok(),
        topUpNeuronForSubmittingProposals: ok(),
        setPremiumItemCost: vi.fn(() => Promise.resolve()),
        updateBlockedUsernamePatterns: vi.fn(() => Promise.resolve()),
        pauseEventLoop: vi.fn(),
        resumeEventLoop: vi.fn(),
    } satisfies ConsoleHooksClient;
}

let log: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    error = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("the platform moderator's hooks", () => {
    test("a group is named by its id, and a message is deleted as a platform moderator", async () => {
        const client = fakeClient();
        const hooks = platformModeratorHooks(client);
        await hooks.freezeGroup("g1", "spam");
        expect(client.freezeGroup).toHaveBeenCalledWith(
            { kind: "group_chat", groupId: "g1" },
            "spam",
        );
        await hooks.deleteMessage("g1", 7n, 3);
        expect(client.deleteMessage).toHaveBeenCalledWith(
            { kind: "group_chat", groupId: "g1" },
            3,
            7n,
            true,
        );
        await hooks.deleteChannelMessage("c1", 42, 8n);
        expect(client.deleteMessage).toHaveBeenLastCalledWith(
            { kind: "channel", communityId: "c1", channelId: 42 },
            undefined,
            8n,
            true,
        );
        expect(log).toHaveBeenCalledWith("Group frozen", "g1");
    });

    test("a failure says so in the console", async () => {
        const client = fakeClient(false);
        await platformModeratorHooks(client).unsuspendUser("u1");
        expect(log).toHaveBeenCalledWith("Failed to unsuspend user", "u1");
    });

    test("the reported messages are logged as an object", async () => {
        const client = fakeClient();
        await platformModeratorHooks(client).reportedMessages("u1");
        expect(client.reportedMessages).toHaveBeenCalledWith("u1");
        expect(log).toHaveBeenCalledWith({ reports: [1] });
    });
});

describe("the platform operator's hooks", () => {
    test("each calls its client method, and a failure is an error", async () => {
        const client = fakeClient(false);
        const hooks = platformOperatorHooks(client);
        await hooks.setTokenEnabled("ledger", false);
        expect(client.setTokenEnabled).toHaveBeenCalledWith("ledger", false);
        expect(error).toHaveBeenCalledWith("Failed to set token disabled", "ledger");
        hooks.pauseEventLoop();
        expect(client.pauseEventLoop).toHaveBeenCalled();
    });
});

describe("installing the hooks", () => {
    test("puts both on the host, and takes off only its own", () => {
        const host: ConsoleHooksHost = {};
        const uninstall = installConsoleHooks(fakeClient(), host);
        expect(host.platformModerator?.freezeGroup).toBeTypeOf("function");
        expect(host.platformOperator?.setTokenEnabled).toBeTypeOf("function");

        // a second App (a remount) installs its own before the first one's cleanup runs
        const second = installConsoleHooks(fakeClient(), host);
        const secondModerator = host.platformModerator;
        uninstall();
        expect(host.platformModerator).toBe(secondModerator);
        second();
        expect(host.platformModerator).toBeUndefined();
        expect(host.platformOperator).toBeUndefined();
    });
});

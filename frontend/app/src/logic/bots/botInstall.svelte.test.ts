import type { ExternalBotLike, GrantedBotPermissions, OpenChat } from "@client";
import { describe, expect, test, vi } from "vitest";
import { BotInstall } from "./botInstall.svelte";

const permissions = { chatPermissions: [], communityPermissions: [], messagePermissions: [] };

// What the bot asks for, which includes a community permission and a chat one
const requested = {
    chatPermissions: ["readMessages" as const],
    communityPermissions: ["createPublicChannel" as const],
    messagePermissions: [],
};

const bot = {
    id: "bot",
    definition: {
        kind: "bot_definition",
        description: "",
        commands: [],
        autonomousConfig: { permissions: requested },
        defaultSubscriptions: undefined,
        dataEncoding: undefined,
        restrictedLocations: undefined,
        miniApps: [],
    },
} as unknown as ExternalBotLike;

const location = { kind: "group_chat" as const, groupId: "rrkah-fqaaa-aaaaa-aaaaq-cai" };

function fakeClient(succeeds: boolean) {
    const installBot = vi.fn(async () => succeeds);
    const updateInstalledBot = vi.fn(async () => succeeds);
    return {
        client: { installBot, updateInstalledBot } as unknown as OpenChat,
        installBot,
        updateInstalledBot,
    };
}

describe("installing a bot", () => {
    // Invariant: a failed install says so and leaves the form usable. Desktop stayed busy for good.
    test("a failed install reports the failure and is no longer busy", async () => {
        const { client } = fakeClient(false);
        const form = new BotInstall(client, bot, location);

        const outcome = await form.save();

        expect(outcome).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "bots.add.failure" }),
        });
        expect(form.busy).toBe(false);
    });

    // Invariant: changing an installed bot's permissions updates them, and never installs it again
    test("a bot already installed has its permissions updated, not installed again", async () => {
        const { client, installBot, updateInstalledBot } = fakeClient(true);
        const installed: GrantedBotPermissions = { command: permissions, autonomous: permissions };
        const form = new BotInstall(client, bot, location, installed);

        expect((await form.save()).kind).toBe("updated");
        expect(installBot).not.toHaveBeenCalled();
        expect(updateInstalledBot).toHaveBeenCalledWith(location, "bot", installed);
    });

    // Invariant: the bot is installed with exactly the permissions the user chose, never any
    // community permission outside a community
    test("a bot is installed in a group with the permissions the user chose and none for a community", async () => {
        const { client, installBot } = fakeClient(true);
        const form = new BotInstall(client, bot, location);
        form.grantedPermissions.autonomous!.chatPermissions = [];

        expect((await form.save()).kind).toBe("installed");
        expect(installBot).toHaveBeenCalledWith(location, "bot", {
            command: permissions,
            autonomous: { ...requested, chatPermissions: [], communityPermissions: [] },
        });
    });

    // Invariant: an update sends the permissions as the user changed them
    test("an update sends the permissions as the user changed them", async () => {
        const { client, updateInstalledBot } = fakeClient(true);
        const installed: GrantedBotPermissions = { command: permissions, autonomous: requested };
        const form = new BotInstall(client, bot, location, structuredClone(installed));
        form.grantedPermissions.autonomous!.chatPermissions = [];

        await form.save();
        expect(updateInstalledBot).toHaveBeenCalledWith(location, "bot", {
            command: permissions,
            autonomous: { ...requested, chatPermissions: [] },
        });
    });
});

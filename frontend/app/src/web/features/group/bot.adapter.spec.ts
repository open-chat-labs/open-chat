import type { BotDefinition, GrantedBotPermissions } from "@client";
import { describe, expect, test } from "vitest";
import { botPermissions, grantedFromDialog, grantedKeys } from "./bot.adapter";

const definition = {
    kind: "bot_definition",
    description: "",
    commands: [
        {
            name: "pin",
            params: [],
            permissions: {
                chatPermissions: ["pinMessages"],
                communityPermissions: ["createPublicChannel"],
                messagePermissions: ["text"],
            },
        },
    ],
    autonomousConfig: {
        permissions: {
            chatPermissions: ["readMessages"],
            communityPermissions: [],
            messagePermissions: ["image"],
        },
    },
} as unknown as BotDefinition;

const labels = {
    permission: (scope: string, name: string) => `${scope}.${name}`,
    group: (use: string, scope: string) => `${use}.${scope}`,
};
const group = { kind: "group_chat" as const, groupId: "g" };
const community = { kind: "community" as const, communityId: "c" };

describe("a bot's permissions in BotDialog", () => {
    // what a bot is granted is exactly what the user toggled on, for commands and autonomous use
    // apart, never something mapped or added
    test("grants exactly the permissions toggled on", () => {
        const { perms } = botPermissions(definition, community, labels);
        const requested: GrantedBotPermissions = {
            command: {
                chatPermissions: ["pinMessages"],
                communityPermissions: ["createPublicChannel"],
                messagePermissions: ["text"],
            },
            autonomous: {
                chatPermissions: ["readMessages"],
                communityPermissions: [],
                messagePermissions: ["image"],
            },
        };
        const toggles = Object.fromEntries(perms.map((k) => [k, false]));
        toggles["command:chat:pinMessages"] = true;
        toggles["autonomous:message:image"] = true;

        expect(grantedFromDialog(toggles, requested)).toEqual({
            command: {
                chatPermissions: ["pinMessages"],
                communityPermissions: [],
                messagePermissions: [],
            },
            autonomous: {
                chatPermissions: [],
                communityPermissions: [],
                messagePermissions: ["image"],
            },
        });
        // and what an installed bot has reads back as those same toggles
        expect(grantedKeys(grantedFromDialog(toggles, requested))).toEqual({
            "command:chat:pinMessages": true,
            "autonomous:message:image": true,
        });
    });

    test("asks for community permissions only in a community", () => {
        expect(botPermissions(definition, group, labels).perms).not.toContain(
            "command:community:createPublicChannel",
        );
        expect(botPermissions(definition, community, labels).perms).toContain(
            "command:community:createPublicChannel",
        );
    });
});

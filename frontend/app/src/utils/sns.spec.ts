import type { ExternalBot } from "openchat-client";
import { createPublishExternalBotPayload } from "./sns";

function createTestBot(): ExternalBot {
    return {
        kind: "external_bot",
        name: "test_bot",
        avatarUrl: "avatar_url",
        id: "bot_id",
        ownerId: "owner_id",
        endpoint: "https://my_bot",
        registrationStatus: { kind: "public" },
        definition: {
            kind: "bot_definition",
            description: "This is a test bot",
            commands: [
                {
                    name: "command_one",
                    defaultRole: "member",
                    description: "this is a test command",
                    permissions: {
                        chatPermissions: ["addMembers"],
                        communityPermissions: ["changeRoles"],
                        messagePermissions: ["text"],
                    },
                    params: [
                        {
                            kind: "string",
                            name: "param_one",
                            description: "this is a test param",
                            placeholder: "enter the test param",
                            required: true,
                            maxLength: 100,
                            minLength: 0,
                            choices: [
                                { name: "one", value: "one" },
                                { name: "two", value: "two" },
                            ],
                        },
                        {
                            kind: "user",
                            name: "param_two",
                            description: "pick a user",
                            placeholder: "enter user",
                            required: false,
                        },
                        {
                            kind: "boolean",
                            name: "param_three",
                            description: "is it true",
                            placeholder: "is it true",
                            required: true,
                        },
                        {
                            kind: "decimal",
                            name: "param_four",
                            description: "what's your favourite number",
                            placeholder: "what's your favourite number",
                            required: true,
                            minValue: 0,
                            maxValue: 100,
                            choices: [],
                        },
                        {
                            kind: "integer",
                            name: "param_five",
                            description: "pick a number between 1 and 3",
                            placeholder: "pick a number between 1 and 3",
                            required: true,
                            minValue: BigInt(1),
                            maxValue: BigInt(5),
                            choices: [
                                {
                                    name: "One",
                                    value: BigInt(1),
                                },
                                {
                                    name: "Two",
                                    value: BigInt(2),
                                },
                                {
                                    name: "Three",
                                    value: BigInt(3),
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    };
}

describe("encoding external bot", () => {
    // All this does is just check that the encoding doesn't fail. Better than nothing.
    test("happy path encoding fully specified bot", () => {
        const bot = createTestBot();
        expect(() => createPublishExternalBotPayload(bot)).not.toThrow();
    });
});

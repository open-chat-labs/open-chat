import { ROLE_MEMBER, type ExternalBot, type MessageContext } from "@shared";
import { BotState, botState } from "./bots.svelte";

const messageContext: MessageContext = { chatId: { kind: "group_chat", groupId: "123456" } };

describe("bot state", () => {
    beforeAll(() => {
        botState.messageFormatter = (s) => s;
    });
    afterEach(() => botState.cancel());
    describe("prefix processing", () => {
        test("setting prefix", () => {
            const prefix = "/command one two three";
            botState.prefix = prefix;
            expect(botState.prefix).toEqual(prefix);
            expect(botState.prefixParts).toEqual(["/command", "one", "two", "three"]);
            expect(botState.parsedPrefix).toEqual("command");
        });
    });

    describe("commands", () => {
        test("unfiltered built in commands", () => {
            expect(botState.commands.length).toBeGreaterThan(0);
        });

        test("filtered built in commands", () => {
            botState.prefix = "register_b";
            expect(botState.commands.length).toEqual(1);
            expect(botState.commands[0].name).toEqual("register_bot");
            botState.prefix = "gif";
            expect(botState.commands.length).toEqual(1);
            expect(botState.commands[0].name).toEqual("gif");
        });

        describe("set selected command", () => {
            test("set selected command - no params", () => {
                botState.prefix = "register";
                botState.setSelectedCommand(
                    messageContext,
                    botState.commands,
                    botState.commands[0],
                );
                expect(botState.selectedCommand).toEqual(botState.commands[0]);
                expect(botState.showingBuilder).toBeUndefined();
            });
            test("set selected command - with params", () => {
                botState.prefix = "faq";
                botState.setSelectedCommand(
                    messageContext,
                    botState.commands,
                    botState.commands[0],
                );
                expect(botState.selectedCommand).toEqual(botState.commands[0]);
                expect(botState.showingBuilder).toEqual(messageContext);
                expect(botState.selectedCommandArgs.length).toEqual(1);
                expect(botState.selectedCommandArgs[0]).toMatchObject({
                    name: "bots.faq.params.topic.name",
                    value: "",
                });
                expect(
                    botState.instanceIsValid(
                        botState.selectedCommand!,
                        botState.selectedCommandArgs,
                    ),
                ).toBe(false);

                // TODO - this _should_ in fact fail
                expect(
                    botState.instanceIsValid(botState.selectedCommand!, [
                        {
                            kind: "string",
                            name: "",
                            value: "something",
                        },
                    ]),
                );
            });
        });
    });

    describe("one that goes by another's bots", () => {
        const bot: ExternalBot = {
            kind: "external_bot",
            id: "wb",
            name: "Weatherbot",
            ownerId: "owner",
            endpoint: "https://wb",
            registrationStatus: { kind: "public" },
            definition: {
                kind: "bot_definition",
                description: "",
                commands: [
                    {
                        name: "weather",
                        description: "Ask the sky",
                        defaultRole: ROLE_MEMBER,
                        directMessages: false,
                        permissions: {
                            chatPermissions: [],
                            communityPermissions: [],
                            messagePermissions: [],
                        },
                        params: [],
                    },
                ],
                autonomousConfig: undefined,
                defaultSubscriptions: undefined,
                dataEncoding: undefined,
                restrictedLocations: undefined,
                miniApps: [],
            },
        };

        test("lists its source's bots, with its formatter, for its own prefix", () => {
            const source = new BotState();
            const own = new BotState(source);
            source.messageFormatter = (s) => (s === "Ask the sky" ? "the forecast" : s);
            source.setExternalBots([bot]);
            source.prefix = "/faq";
            own.prefix = "/forecast";
            expect(own.commands.map((c) => c.name)).toEqual(["weather"]);
            expect(source.commands.map((c) => c.name)).toEqual(["faq"]);
        });

        test("keeps its own pick", () => {
            const source = new BotState();
            const own = new BotState(source);
            own.prefix = "/faq";
            own.setSelectedCommand(messageContext, own.commands, own.commands[0]);
            expect(own.selectedCommand?.name).toBe("faq");
            expect(source.selectedCommand).toBeUndefined();
            expect(source.commands.length).toBeGreaterThan(1);
        });
    });
});

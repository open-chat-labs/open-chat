import type { MessageContext } from "openchat-shared";
import { botState } from "./bots.svelte";

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
});

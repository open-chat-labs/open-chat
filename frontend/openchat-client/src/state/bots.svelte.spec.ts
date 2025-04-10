import { botState } from "./bots.svelte";

describe("bot state", () => {
    beforeAll(() => (botState.messageFormatter = (s) => s));
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
            botState.prefix = "register";
            expect(botState.commands.length).toEqual(1);
            expect(botState.commands[0].name).toEqual("register_bot");
            botState.prefix = "gif";
            expect(botState.commands.length).toEqual(1);
            expect(botState.commands[0].name).toEqual("gif");
        });

        describe("set selected command", () => {
            test("set selected command - no params", () => {
                botState.prefix = "register";
                botState.setSelectedCommand(botState.commands, botState.commands[0]);
                expect(botState.selectedCommand).toEqual(botState.commands[0]);
                expect(botState.showingBuilder).toBe(false);
            });
            test("set selected command - with params", () => {
                botState.prefix = "faq";
                botState.setSelectedCommand(botState.commands, botState.commands[0]);
                expect(botState.selectedCommand).toEqual(botState.commands[0]);
                expect(botState.showingBuilder).toBe(true);
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

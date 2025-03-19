import { commandSupportsDirectMessages, type CommandDefinition, type CommandParam } from "./bots";

function stringParam(required: boolean): CommandParam {
    return {
        kind: "string",
        name: "test",
        required,
        minLength: 1,
        maxLength: 100,
        choices: [],
        multi_line: false,
    };
}

const command: CommandDefinition = {
    name: "test",
    description: "test command",
    params: [stringParam(true)],
    permissions: {
        chatPermissions: [],
        communityPermissions: [],
        messagePermissions: [],
    },
    defaultRole: "member",
    directMessages: true,
};

describe("direct message qualification", () => {
    test("single required string param", () => {
        command.params = [stringParam(true)];
        expect(commandSupportsDirectMessages(command)).toEqual(true);
    });

    test("single optional string param", () => {
        command.params = [stringParam(false)];
        expect(commandSupportsDirectMessages(command)).toEqual(true);
    });

    test("two required string params", () => {
        command.params = [stringParam(true), stringParam(true)];
        expect(commandSupportsDirectMessages(command)).toEqual(false);
    });

    test("a second optional string param", () => {
        command.params = [stringParam(true), stringParam(false)];
        expect(commandSupportsDirectMessages(command)).toEqual(true);
    });

    test("first string param is optional", () => {
        command.params = [stringParam(false), stringParam(true)];
        expect(commandSupportsDirectMessages(command)).toEqual(false);
    });
});

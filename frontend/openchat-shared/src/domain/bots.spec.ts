import { commandSupportsDirectMessages, type CommandDefinition, type CommandParam } from "./bots";
import { ROLE_MEMBER } from "../constants";

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
    defaultRole: ROLE_MEMBER,
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

describe("a date argument typed in words", () => {
    // each test gets the module afresh, so that the date parser starts out not yet loaded
    async function freshModule() {
        vi.resetModules();
        return await import("./bots");
    }

    function when(bots: Awaited<ReturnType<typeof freshModule>>, typed: string) {
        const [arg] = bots.createArgsFromSchema([bots.defaultDateTimeParam()], [typed]);
        return arg.kind === "dateTime" ? arg.value : undefined;
    }

    test("is understood once the date parser has loaded", async () => {
        const bots = await freshModule();
        await bots.loadDateParser();
        const tomorrow = when(bots, "tomorrow at 9am");
        expect(typeof tomorrow).toBe("bigint");
        expect(tomorrow! > BigInt(Date.now())).toBe(true);
    });

    test("a timestamp needs no date parser", async () => {
        const bots = await freshModule();
        expect(when(bots, "1790000000000")).toBe(1790000000000n);
    });

    // Invariant: loading never rejects, as a command can be given its date in the builder instead.
    test("loading the date parser resolves even if it cannot be fetched, and can be retried", async () => {
        vi.resetModules();
        vi.doMock("chrono-node", () => {
            throw new Error("offline");
        });
        vi.spyOn(console, "error").mockImplementation(() => {});
        const broken = await import("./bots");
        await expect(broken.loadDateParser()).resolves.toBeUndefined();
        expect(when(broken, "tomorrow at 9am")).toBeNull();

        vi.doUnmock("chrono-node");
        await broken.loadDateParser();
        expect(typeof when(broken, "tomorrow at 9am")).toBe("bigint");
        vi.restoreAllMocks();
    });
});

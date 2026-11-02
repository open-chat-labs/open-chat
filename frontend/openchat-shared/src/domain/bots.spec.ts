import {
    commandSupportsDirectMessages,
    createArgsFromSchema,
    directMessageCommandInstance,
    emptyBotInstance,
    permissionsToGrant,
    shownArgs,
    shownArgsAreValid,
    shownParams,
    validateBot,
    type BotDefinition,
    type CommandArg,
    type CommandDefinition,
    type CommandParam,
    type CommandParamCommon,
    type CommandParamCondition,
    type StringParam,
} from "./bots";
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

describe("the permissions offered when installing a bot", () => {
    const permissions = {
        chatPermissions: [],
        communityPermissions: ["createPublicChannel" as const],
        messagePermissions: [],
    };
    const definition: BotDefinition = {
        kind: "bot_definition",
        description: "",
        commands: [{ ...command, permissions }],
        autonomousConfig: { permissions },
        defaultSubscriptions: undefined,
        dataEncoding: undefined,
        restrictedLocations: undefined,
        miniApps: [],
    };

    // Invariant: a bot installed outside a community is never granted community permissions, in
    // either tree. Mobile granted them to a bot installed in a direct chat.
    test("include community permissions only when installing in a community", () => {
        const inCommunity = permissionsToGrant(definition, {
            kind: "community",
            communityId: "rrkah-fqaaa-aaaaa-aaaaq-cai",
        });
        expect(inCommunity.command.communityPermissions).toEqual(["createPublicChannel"]);
        expect(inCommunity.autonomous?.communityPermissions).toEqual(["createPublicChannel"]);

        for (const location of [
            { kind: "group_chat" as const, groupId: "rrkah-fqaaa-aaaaa-aaaaq-cai" },
            { kind: "direct_chat" as const, userId: "rrkah-fqaaa-aaaaa-aaaaq-cai" },
        ]) {
            const outside = permissionsToGrant(definition, location);
            expect(outside.command.communityPermissions).toEqual([]);
            expect(outside.autonomous?.communityPermissions).toEqual([]);
        }
    });
});

describe("params shown only while an earlier param has a value", () => {
    function when(param: string, values: string[]): CommandParamCondition {
        return { param, values };
    }

    function choiceParam(name: string, required: boolean): StringParam & CommandParamCommon {
        return {
            kind: "string",
            name,
            required,
            minLength: 1,
            maxLength: 100,
            choices: [],
            multi_line: false,
        };
    }

    const game: CommandParam = {
        ...choiceParam("game", true),
        choices: [
            { name: "Chess", value: "chess" },
            { name: "Maze", value: "maze" },
        ],
    };
    // Every game has a time limit, but an hour only for chess
    const minutes: CommandParam = {
        kind: "integer",
        name: "minutes",
        required: false,
        minValue: 1n,
        maxValue: 60n,
        choices: [
            { name: "1", value: 1n },
            { name: "60", value: 60n, visible_when: when("game", ["chess"]) },
        ],
    };
    const white: CommandParam = {
        ...choiceParam("white", false),
        choices: [
            { name: "The host", value: "host" },
            { name: "Random", value: "random" },
        ],
        visible_when: when("game", ["chess"]),
    };
    // Shown through a chain: only for chess, when the host plays White
    const handicap: CommandParam = {
        kind: "boolean",
        name: "handicap",
        required: true,
        visible_when: when("white", ["host"]),
    };
    const params = [game, minutes, white, handicap];

    function args(gameValue: string, minutesValue: bigint | null, whiteValue?: string) {
        return [
            { kind: "string", name: "game", value: gameValue },
            { kind: "integer", name: "minutes", value: minutesValue },
            { kind: "string", name: "white", value: whiteValue },
            { kind: "boolean", name: "handicap", value: true },
        ] as CommandArg[];
    }

    function names(shown: (CommandParam | undefined)[]) {
        return shown.map((p) => p?.name);
    }

    test("a param without a condition is always shown", () => {
        expect(shownParams([game], [])).toEqual([game]);
    });

    test("a param is shown while the param its condition names has one of its values", () => {
        expect(names(shownParams(params, args("chess", null)))).toEqual([
            "game",
            "minutes",
            "white",
            undefined,
        ]);
        expect(names(shownParams(params, args("maze", null)))).toEqual([
            "game",
            "minutes",
            undefined,
            undefined,
        ]);
        expect(names(shownParams(params, args("", null)))).toEqual([
            "game",
            "minutes",
            undefined,
            undefined,
        ]);
    });

    test("a condition on a hidden param doesn't hold, whatever that param's value", () => {
        expect(names(shownParams(params, args("chess", null, "host")))[3]).toEqual("handicap");
        expect(names(shownParams(params, args("maze", null, "host")))[3]).toBeUndefined();
    });

    test("a choice is shown while its condition holds", () => {
        const choices = (shown: CommandParam | undefined) =>
            shown?.kind === "integer" ? shown.choices.map((c) => c.value) : undefined;
        expect(choices(shownParams(params, args("chess", null))[1])).toEqual([1n, 60n]);
        expect(choices(shownParams(params, args("maze", null))[1])).toEqual([1n]);
        // a param none of whose choices has a condition is shown as it is
        expect(shownParams(params, args("maze", null))[0]).toBe(game);
    });

    test("a condition naming a later param never holds", () => {
        const later = { ...white, visible_when: when("handicap", ["true"]) };
        expect(names(shownParams([later, handicap], []))).toEqual([undefined, undefined]);
    });

    test("a param with choices, none of them shown, is hidden", () => {
        const onlyChess: CommandParam = {
            ...minutes,
            choices: [{ name: "60", value: 60n, visible_when: when("game", ["chess"]) }],
        };
        expect(names(shownParams([game, onlyChess], args("chess", null)))).toEqual([
            "game",
            "minutes",
        ]);
        expect(names(shownParams([game, onlyChess], args("maze", null)))).toEqual([
            "game",
            undefined,
        ]);
    });

    test("a chosen value the param no longer shows is sent unset, and kept for later", () => {
        const chosen = args("maze", 60n, "host");
        expect(shownArgs(params, chosen)[1]).toMatchObject({ name: "minutes", value: null });
        // the arg keeps it, for when it's shown again, as a hidden param keeps its value
        expect(chosen[1]).toMatchObject({ value: 60n });
        expect(chosen[2]).toMatchObject({ value: "host" });

        expect(shownArgs(params, args("chess", 60n))[1]).toMatchObject({ value: 60n });
    });

    test("a value that's a hidden choice counts as unset", () => {
        // optional, so valid without it
        expect(shownArgsAreValid(params, args("maze", 60n))).toBe(true);
        // required, so not
        const required = [game, { ...minutes, required: true }];
        expect(shownArgsAreValid(required, args("maze", 60n))).toBe(false);
        expect(shownArgsAreValid(required, args("maze", 1n))).toBe(true);
        // and a hidden required param isn't asked for
        expect(shownArgsAreValid(params, args("chess", null, "random"))).toBe(true);
        expect(shownArgsAreValid(params, args("chess", null, ""))).toBe(false);
    });

    test("only the shown params' args are sent", () => {
        expect(shownArgs(params, args("maze", 1n, "host")).map((a) => a.name)).toEqual([
            "game",
            "minutes",
        ]);
        expect(shownArgs(params, args("chess", 1n, "host")).map((a) => a.name)).toEqual([
            "game",
            "minutes",
            "white",
            "handicap",
        ]);
    });

    test("typed values go to the shown params, in order", () => {
        const typed = (values: string[]) =>
            createArgsFromSchema([game, white, minutes], values).map((a) =>
                a.kind === "user" ? undefined : a.value,
            );
        expect(typed(["chess", "host", "60"])).toEqual(["chess", "host", 60n]);
        // "white" is hidden for the maze, so the next value is the time limit, an hour isn't one
        // of the maze's choices
        expect(typed(["maze", "1"])).toEqual(["maze", "", 1n]);
        expect(typed(["maze", "60"])).toEqual(["maze", "", null]);
        // a game which isn't one leaves the rest unassigned, as which params they're for hangs on it
        expect(typed(["chesss", "host", "5"])).toEqual(["", "", null]);
    });

    test("a direct message sends only the shown params' args", () => {
        const bot = emptyBotInstance("owner");
        const text: CommandParam = { ...choiceParam("text", true), choices: [] };
        const verbose: CommandParam = {
            kind: "boolean",
            name: "verbose",
            required: false,
            visible_when: when("text", ["never"]),
        };
        bot.definition.commands = [{ ...command, params: [text, verbose], directMessages: true }];
        const instance = directMessageCommandInstance(bot, "hello");
        expect(
            instance?.kind === "external_bot" && instance.command.arguments.map((a) => a.name),
        ).toEqual(["text"]);
    });

    test("the bot builder refuses a condition the UserIndex would", () => {
        const errors = (conditioned: CommandParam) => {
            const bot = emptyBotInstance("owner");
            bot.definition.commands = [{ ...command, params: [game, conditioned] }];
            return validateBot("", bot, "update").get("command_0_conditions");
        };
        expect(errors(white)).toEqual([]);
        expect(errors(minutes)).toEqual([]);
        for (const condition of [
            when("games", ["chess"]),
            when("game", ["go"]),
            when("game", []),
            when("white", ["host"]),
        ]) {
            expect(errors({ ...white, visible_when: condition })).toHaveLength(1);
        }
        // on a choice too
        const bullet = { name: "60", value: 60n, visible_when: when("game", ["go"]) };
        expect(errors({ ...minutes, choices: [bullet] })).toHaveLength(1);
    });
});

import {
    BotState,
    ROLE_MEMBER,
    type BotCommandInstance,
    type BotCommandResult,
    type CommandDefinition,
    type CommandPlace,
    type ExternalBot,
    type GroupChatSummary,
    type MessageContext,
    type MessagePermission,
} from "@client";
import { CommandPicker } from "./commandPicker.svelte";

const context: MessageContext = { chatId: { kind: "group_chat", groupId: "g" } };
const none = { chatPermissions: [], communityPermissions: [], messagePermissions: [] };

const place: CommandPlace = {
    chatKind: "group_chat",
    chat: {
        kind: "group_chat",
        id: context.chatId,
        membership: { role: ROLE_MEMBER },
        permissions: {},
    } as GroupChatSummary,
    directBotId: undefined,
    permitted: new Set<MessagePermission>(["text", "poll"]),
    installedBots: new Map([
        ["wb", { command: { ...none, messagePermissions: ["text"] }, autonomous: undefined }],
    ]),
};

const weather: CommandDefinition = {
    name: "weather",
    description: "The weather",
    defaultRole: ROLE_MEMBER,
    directMessages: false,
    permissions: { ...none, messagePermissions: ["text"] },
    params: [
        {
            kind: "string",
            name: "city",
            required: true,
            minLength: 1,
            maxLength: 50,
            choices: [],
            multi_line: false,
        },
    ],
};

function bot(commands: CommandDefinition[]): ExternalBot {
    return {
        kind: "external_bot",
        id: "wb",
        name: "Weatherbot",
        ownerId: "owner",
        endpoint: "https://wb",
        registrationStatus: { kind: "public" },
        definition: {
            kind: "bot_definition",
            description: "",
            commands,
            autonomousConfig: undefined,
            defaultSubscriptions: undefined,
            dataEncoding: undefined,
            restrictedLocations: undefined,
            miniApps: [],
        },
    };
}

function setUp(handles: string[] = ["poll", "faq", "diamond"]) {
    const bots = new BotState();
    bots.setExternalBots([bot([weather])]);
    const ran: BotCommandInstance[] = [];
    const client = {
        executeBotCommand: vi.fn(async (_scope: unknown, instance: BotCommandInstance) => {
            ran.push(instance);
            return "success" as BotCommandResult;
        }),
    };
    const picker = new CommandPicker(client, bots, async () => {});
    const offered = () => picker.offered(place, (c) => handles.includes(c.name));
    return { bots, client, picker, offered, ran };
}

describe("a bot command typed in the composer", () => {
    test("lists nothing until a '/' is typed", () => {
        const { offered } = setUp();
        expect(offered()).toEqual([]);
    });

    test("lists those the reader may run here that match, the built-in ones this tree carries out", () => {
        const { picker, offered } = setUp();
        picker.typed("/");
        // crypto needs the crypto permission; gif, search … aren't carried out here
        expect(offered().map((c) => c.name)).toEqual(["diamond", "faq", "poll", "weather"]);
        picker.typed("/wea");
        expect(offered().map((c) => c.name)).toEqual(["weather"]);
    });

    test("one with nothing to ask runs at once, and the picking's over", async () => {
        const { picker, offered, client, bots } = setUp();
        picker.typed("/po");
        const pick = await picker.pick(context, offered(), offered()[0]);
        expect(pick.kind).toBe("sent");
        if (pick.kind === "sent") expect(await pick.result).toBe("success");
        expect(client.executeBotCommand).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "chat_scope", chatId: context.chatId }),
            { kind: "internal_bot", command: { name: "poll", arguments: [] } },
        );
        expect(bots.prefix).toBe("");
        expect(offered()).toEqual([]);
    });

    test("takes the arguments typed after its name", async () => {
        const { picker, offered, ran } = setUp();
        picker.typed("/weather Paris");
        const [weather] = offered();
        expect((await picker.pick(context, offered(), weather)).kind).toBe("sent");
        expect(ran[0]).toMatchObject({
            kind: "external_bot",
            id: "wb",
            command: { name: "weather", arguments: [{ name: "city", value: "Paris" }] },
        });
    });

    test("one whose arguments aren't all there asks for them, then runs from the form", async () => {
        const { picker, offered, ran } = setUp();
        picker.typed("/weather");
        const pick = await picker.pick(context, offered(), offered()[0]);
        expect(pick.kind).toBe("needs_args");
        expect(picker.valid).toBe(false);
        expect(picker.shown.map((p) => p?.name)).toEqual(["city"]);
        expect(picker.submit(context)).toBeUndefined();
        picker.setArg(0, { kind: "string", name: "city", value: "Rome" });
        expect(picker.valid).toBe(true);
        expect(await picker.submit(context)).toBe("success");
        expect(ran[0].command.arguments).toEqual([{ kind: "string", name: "city", value: "Rome" }]);
    });

    test("cancelled, nothing runs and nothing's listed", async () => {
        const { picker, offered, client } = setUp();
        picker.typed("/weather");
        await picker.pick(context, offered(), offered()[0]);
        picker.cancel();
        expect(client.executeBotCommand).not.toHaveBeenCalled();
        expect(offered()).toEqual([]);
    });

    test("one with a date waits for the date parser, and a pick meanwhile overtakes it", async () => {
        const bots = new BotState();
        const remind: CommandDefinition = {
            ...weather,
            name: "remind",
            params: [{ kind: "dateTime", name: "when", required: true, future_only: true }],
        };
        bots.setExternalBots([bot([remind])]);
        let release: () => void = () => {};
        const parser = new Promise<void>((r) => (release = r));
        const picker = new CommandPicker({ executeBotCommand: vi.fn() }, bots, () => parser);
        picker.typed("/");
        const offered = picker.offered(place, (c) => c.name === "poll");
        expect(offered.map((c) => c.name)).toEqual(["poll", "remind"]);
        const first = picker.pick(context, offered, offered[1]);
        const second = picker.pick(context, offered, offered[0]);
        expect((await first).kind).toBe("gone");
        expect((await second).kind).toBe("sent");
        release();
        await parser;
        expect(bots.selectedCommand).toBeUndefined();
    });

    test("the '/' going leaves the other composer's typing alone", () => {
        const { bots } = setUp();
        const chat = new CommandPicker({ executeBotCommand: vi.fn() }, bots, async () => {});
        const thread = new CommandPicker({ executeBotCommand: vi.fn() }, bots, async () => {});
        thread.typed("/fa");
        chat.typed(undefined);
        expect(bots.prefix).toBe("/fa");
        thread.typed(undefined);
        expect(bots.prefix).toBe("");
    });
});

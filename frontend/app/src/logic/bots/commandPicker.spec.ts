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
        const { picker, offered, client } = setUp();
        picker.typed("/po");
        const pick = await picker.pick(context, offered(), offered()[0]);
        expect(pick.kind).toBe("sent");
        if (pick.kind === "sent") expect(await pick.result).toBe("success");
        expect(client.executeBotCommand).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "chat_scope", chatId: context.chatId }),
            { kind: "internal_bot", command: { name: "poll", arguments: [] } },
        );
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
        expect(picker.form).toEqual({
            context,
            command: expect.objectContaining({ name: "weather" }),
        });
        expect(picker.valid).toBe(false);
        expect(picker.shown.map((p) => p?.name)).toEqual(["city"]);
        expect(picker.submit(context)).toBeUndefined();
        expect(picker.form).toBeDefined();
        picker.setArg(0, { kind: "string", name: "city", value: "Rome" });
        expect(picker.valid).toBe(true);
        expect(await picker.submit(context)).toBe("success");
        expect(ran[0].command.arguments).toEqual([{ kind: "string", name: "city", value: "Rome" }]);
        expect(picker.form).toBeUndefined();
        if (pick.kind === "needs_args") expect(await pick.sent).toBe(true);
    });

    test("cancelled, nothing runs, nothing's listed and the form closes, not sent", async () => {
        const { picker, offered, client } = setUp();
        picker.typed("/weather");
        const pick = await picker.pick(context, offered(), offered()[0]);
        picker.cancel();
        expect(client.executeBotCommand).not.toHaveBeenCalled();
        expect(offered()).toEqual([]);
        expect(picker.form).toBeUndefined();
        if (pick.kind === "needs_args") expect(await pick.sent).toBe(false);
    });

    test("the composer going (another chat opened) closes the form, not sent", async () => {
        const { picker, offered, client } = setUp();
        picker.typed("/weather");
        const pick = await picker.pick(context, offered(), offered()[0]);
        expect(pick.kind).toBe("needs_args");
        picker.typed(undefined);
        expect(picker.form).toBeUndefined();
        if (pick.kind === "needs_args") expect(await pick.sent).toBe(false);
        expect(client.executeBotCommand).not.toHaveBeenCalled();
    });

    test("loads the date parser it's given once a '/' is typed", () => {
        const { bots } = setUp();
        const loadParser = vi.fn(async () => {});
        const picker = new CommandPicker({ executeBotCommand: vi.fn() }, bots, loadParser);
        picker.typed("/");
        picker.typed("/we");
        expect(loadParser).toHaveBeenCalledTimes(1);
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
        expect(picker.form).toBeUndefined();
        expect(picker.shown).toEqual([]);
    });

    describe("a chat's and a thread's composers", () => {
        function two() {
            const { bots } = setUp();
            const picker = () =>
                new CommandPicker({ executeBotCommand: vi.fn() }, bots, async () => {});
            const chat = picker();
            const thread = picker();
            const names = (p: CommandPicker) =>
                p
                    .offered(place, (c) => ["poll", "faq", "diamond"].includes(c.name))
                    .map((c) => c.name);
            return { bots, chat, thread, names };
        }

        test("the '/' going in one leaves the other's typing alone", () => {
            const { chat, thread, names } = two();
            thread.typed("/fa");
            chat.typed(undefined);
            expect(names(thread)).toEqual(["faq"]);
        });

        test("each lists for its own typing, both typing", () => {
            const { chat, thread, names } = two();
            chat.typed("/po");
            thread.typed("/");
            expect(names(chat)).toEqual(["poll"]);
            expect(names(thread)).toEqual(["diamond", "faq", "poll", "weather"]);
            // the '/' deleted in the thread's: the chat's still lists /po's, not every command
            thread.typed(undefined);
            expect(names(chat)).toEqual(["poll"]);
            expect(names(thread)).toEqual([]);
        });

        test("a pick in one leaves the other's list and picking alone", async () => {
            const { chat, thread, names } = two();
            chat.typed("/");
            thread.typed("/weather");
            const offered = thread.offered(place, () => true);
            const pick = await thread.pick(context, offered, offered[0]);
            expect(pick.kind).toBe("needs_args");
            expect(chat.form).toBeUndefined();
            expect(chat.shown).toEqual([]);
            expect(names(chat)).toEqual(["diamond", "faq", "poll", "weather"]);
            chat.typed(undefined);
            expect(thread.form?.command.name).toBe("weather");
        });

        test("neither's typing is the app's", () => {
            const { bots, chat } = two();
            chat.typed("/po");
            expect(bots.prefix).toBe("");
            expect(bots.selectedCommand).toBeUndefined();
        });
    });
});

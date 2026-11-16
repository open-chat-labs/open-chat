import {
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_OWNER,
    type ChatPermissions,
    type FlattenedCommand,
    type FlattenedExternalCommand,
    type FlattenedInternalCommand,
    type GrantedBotPermissions,
    type GroupChatSummary,
    type MemberRole,
} from "@shared";
import { describe, expect, test } from "vitest";
import { botCommandFailure, commandsAvailable, type CommandPlace } from "./botCommands";

const none = { chatPermissions: [], communityPermissions: [], messagePermissions: [] };

function internal(name: string, fields: Partial<FlattenedInternalCommand> = {}): FlattenedCommand {
    return {
        kind: "internal_bot",
        name,
        botName: "OpenChat",
        params: [],
        permissions: { ...none, messagePermissions: ["text"] },
        defaultRole: ROLE_MEMBER,
        directMessages: false,
        directBotDisabled: true,
        ...fields,
    };
}

function external(name: string, fields: Partial<FlattenedExternalCommand> = {}): FlattenedCommand {
    return {
        kind: "external_bot",
        name,
        botName: "Helper",
        botId: "helper",
        botEndpoint: "https://helper",
        params: [],
        permissions: { ...none, messagePermissions: ["text"] },
        defaultRole: ROLE_MEMBER,
        directMessages: false,
        ...fields,
    };
}

function group(role: MemberRole, permissions: Partial<ChatPermissions> = {}): GroupChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId: "g" },
        membership: { role },
        permissions: { pinMessages: ROLE_ADMIN, ...permissions },
    } as GroupChatSummary;
}

const granted = (messagePermissions: GrantedBotPermissions["command"]["messagePermissions"]) =>
    new Map<string, GrantedBotPermissions>([
        ["helper", { command: { ...none, messagePermissions }, autonomous: undefined }],
    ]);

function place(fields: Partial<CommandPlace> = {}): CommandPlace {
    return {
        chatKind: "group_chat",
        chat: group(ROLE_MEMBER),
        directBotId: undefined,
        permitted: new Set(["text", "poll", "giphy"]),
        installedBots: granted(["text"]),
        ...fields,
    };
}

const names = (commands: FlattenedCommand[]) => commands.map((c) => c.name);

describe("the bot commands a reader may run", () => {
    test("needs the reader to be able to send what the command posts", () => {
        const poll = internal("poll", { permissions: { ...none, messagePermissions: ["poll"] } });
        const crypto = internal("crypto", {
            permissions: { ...none, messagePermissions: ["crypto"] },
        });
        expect(names(commandsAvailable([poll, crypto], place()))).toEqual(["poll"]);
    });

    test("a bot posting a mini app for the reader needs the reader to be able to post text", () => {
        const game = internal("game", {
            permissions: { ...none, messagePermissions: ["miniApp"] },
        });
        expect(names(commandsAvailable([game], place()))).toEqual(["game"]);
        expect(names(commandsAvailable([game], place({ permitted: new Set(["poll"]) })))).toEqual(
            [],
        );
    });

    test("in a group, needs the reader's role to be the command's", () => {
        const webhook = internal("register_webhook", { defaultRole: ROLE_OWNER });
        expect(names(commandsAvailable([webhook], place()))).toEqual([]);
        expect(names(commandsAvailable([webhook], place({ chat: group(ROLE_OWNER) })))).toEqual([
            "register_webhook",
        ]);
    });

    test("needs the chat to let the reader do what the command asks of it, reading aside", () => {
        const pin = internal("pin", {
            permissions: { ...none, chatPermissions: ["pinMessages", "readMessages"] },
        });
        expect(names(commandsAvailable([pin], place()))).toEqual([]);
        expect(names(commandsAvailable([pin], place({ chat: group(ROLE_ADMIN) })))).toEqual([
            "pin",
        ]);
        const read = internal("read", {
            permissions: { ...none, chatPermissions: ["readMessages"] },
        });
        expect(names(commandsAvailable([read], place()))).toEqual(["read"]);
    });

    test("an installed bot's command needs every permission it asks for granted to the bot", () => {
        const say = external("say");
        const poll = external("poll", { permissions: { ...none, messagePermissions: ["poll"] } });
        expect(names(commandsAvailable([say, poll], place()))).toEqual(["say"]);
        expect(names(commandsAvailable([say], place({ installedBots: new Map() })))).toEqual([]);
    });

    test("in a direct chat with a bot, only its commands and the built-in ones it takes", () => {
        const dm = place({ chatKind: "direct_chat", chat: undefined, directBotId: "helper" });
        const commands = [
            external("say"),
            external("other", { botId: "other" }),
            internal("search", { directBotDisabled: false }),
            internal("poll"),
        ];
        expect(names(commandsAvailable(commands, dm))).toEqual(["say", "search"]);
    });

    test("none a direct chat takes no part in, in a direct chat", () => {
        const webhook = internal("register_webhook", { directChatsDisabled: true });
        expect(
            names(
                commandsAvailable([webhook], place({ chatKind: "direct_chat", chat: undefined })),
            ),
        ).toEqual([]);
    });
});

describe("a bot command that failed", () => {
    test("says so, or that the bot is busy; nothing once it ran", () => {
        expect(botCommandFailure("success")).toBeUndefined();
        expect(botCommandFailure("failure")?.key).toBe("bots.failed");
        expect(botCommandFailure("too_many_requests")?.key).toBe("bots.tooManyRequests");
    });
});

import { ROLE_MEMBER, type FlattenedCommand } from "@client";
import { commandKey, composerCommand } from "./composerCommand";

const none = { chatPermissions: [], communityPermissions: [], messagePermissions: [] };

const faq: FlattenedCommand = {
    kind: "internal_bot",
    name: "faq",
    botName: "bots.builtin.name",
    description: "bots.faq.desc",
    params: [
        {
            kind: "string",
            name: "bots.faq.params.topic.name",
            required: true,
            minLength: 0,
            maxLength: 100,
            choices: [],
            multi_line: false,
        },
    ],
    permissions: none,
    defaultRole: ROLE_MEMBER,
    directMessages: false,
};

const weather: FlattenedCommand = {
    kind: "external_bot",
    name: "weather",
    botName: "Weatherbot",
    botId: "wb",
    botEndpoint: "https://wb",
    avatarUrl: "https://wb/avatar.png",
    params: [],
    permissions: none,
    defaultRole: ROLE_MEMBER,
    directMessages: false,
};

const text = (k: string) => ({ "bots.builtin.name": "OpenChat", "bots.faq.desc": "FAQs" })[k] ?? k;

describe("a command in the composer's list", () => {
    test("shows its name, what it does, its parameters and its bot, in words", () => {
        expect(composerCommand(faq, text)).toEqual({
            key: "openchat/faq",
            name: "faq",
            description: "FAQs",
            botName: "OpenChat",
            avatar: undefined,
            params: [{ name: "bots.faq.params.topic.name", required: true }],
        });
    });

    test("a bot's own has its avatar, and is told apart by its bot", () => {
        expect(composerCommand(weather, text)).toMatchObject({
            key: "wb/weather",
            botName: "Weatherbot",
            avatar: "https://wb/avatar.png",
            description: undefined,
        });
        expect(commandKey({ ...weather, botId: "other" })).toBe("other/weather");
    });
});

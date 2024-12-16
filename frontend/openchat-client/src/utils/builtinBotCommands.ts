import type { InternalBot, SlashCommandPermissions } from "openchat-shared";

export const emptyPermissions: SlashCommandPermissions = {
    chatPermissions: [],
    communityPermissions: [],
    messagePermissions: [],
};

export const builtinBot: InternalBot = {
    kind: "internal_bot",
    name: "bots.builtin.name",
    description: "bots.builtin.desc",
    commands: [
        {
            name: "crypto",
            description: "bots.crypto.desc",
            permissions: {
                ...emptyPermissions,
                messagePermissions: ["crypto"],
            },
            params: [
                {
                    kind: "string",
                    name: "bots.crypto.params.token.name",
                    minLength: 0,
                    maxLength: 10,
                    required: false,
                    description: "bots.crypto.params.token.desc",
                    placeholder: "bots.crypto.params.token.placeholder",
                    choices: [],
                },
                {
                    kind: "number",
                    name: "bots.crypto.params.amount.name",
                    minValue: 0,
                    maxValue: Number.MAX_VALUE,
                    required: false,
                    description: "bots.crypto.params.amount.desc",
                    placeholder: "bots.crypto.params.amount.placeholder",
                    choices: [],
                },
            ],
        },
        {
            name: "diamond",
            description: "bots.diamond.desc",
            permissions: {
                ...emptyPermissions,
                messagePermissions: ["text"],
            },
            params: [],
        },
        {
            name: "gif",
            description: "bots.gif.desc",
            permissions: {
                ...emptyPermissions,
                messagePermissions: ["giphy"],
            },
            params: [
                {
                    kind: "string",
                    name: "bots.gif.params.term.name",
                    minLength: 0,
                    maxLength: 100,
                    required: false,
                    description: "bots.gif.params.term.desc",
                    placeholder: "bots.gif.params.term.placeholder",
                    choices: [],
                },
            ],
        },
        {
            name: "faq",
            description: "bots.faq.desc",
            permissions: {
                ...emptyPermissions,
                messagePermissions: ["text"],
            },
            params: [
                {
                    kind: "string",
                    name: "bots.faq.params.topic.name",
                    minLength: 0,
                    maxLength: 100,
                    required: true,
                    description: "bots.faq.params.topic.desc",
                    placeholder: "bots.faq.params.topic.placeholder",
                    choices: [
                        {
                            name: "bots.faq.params.topic.choices.wallet",
                            value: "wallet",
                        },
                        {
                            name: "bots.faq.params.topic.choices.buychat",
                            value: "buychat",
                        },
                        {
                            name: "bots.faq.params.topic.choices.sendtokens",
                            value: "send_tokens",
                        },
                        {
                            name: "bots.faq.params.topic.choices.diamond",
                            value: "diamond",
                        },
                        {
                            name: "bots.faq.params.topic.choices.referral",
                            value: "referral_rewards",
                        },
                        {
                            name: "bots.faq.params.topic.choices.voting",
                            value: "voting",
                        },
                        {
                            name: "bots.faq.params.topic.choices.airdrop",
                            value: "airdrop",
                        },
                        {
                            name: "bots.faq.params.topic.choices.ios",
                            value: "ios_app",
                        },
                        {
                            name: "bots.faq.params.topic.choices.android",
                            value: "android_app",
                        },
                        {
                            name: "bots.faq.params.topic.choices.style",
                            value: "style_messages",
                        },
                        {
                            name: "bots.faq.params.topic.choices.storage",
                            value: "storage",
                        },
                        {
                            name: "bots.faq.params.topic.choices.security",
                            value: "security",
                        },
                        {
                            name: "bots.faq.params.topic.choices.info",
                            value: "info",
                        },
                        {
                            name: "bots.faq.params.topic.choices.shortcuts",
                            value: "shortcuts",
                        },
                        {
                            name: "bots.faq.params.topic.choices.content",
                            value: "content",
                        },
                        {
                            name: "bots.faq.params.topic.choices.translation",
                            value: "translation",
                        },
                    ],
                },
            ],
        },
        {
            name: "poll",
            description: "bots.poll.desc",
            permissions: {
                ...emptyPermissions,
                messagePermissions: ["poll"],
            },
            params: [],
        },
        {
            name: "register_bot",
            description: "bots.register_bot.desc",
            permissions: emptyPermissions,
            params: [],
            devmode: true,
        },
        {
            name: "search",
            description: "bots.search.desc",
            permissions: emptyPermissions,
            params: [
                {
                    kind: "string",
                    name: "bots.search.params.term.name",
                    minLength: 0,
                    maxLength: 100,
                    required: false,
                    description: "bots.search.params.term.desc",
                    placeholder: "bots.search.params.term.placeholder",
                    choices: [],
                },
            ],
        },
        {
            name: "test-msg",
            description: "Create and send a number of test messages",
            devmode: true,
            permissions: {
                ...emptyPermissions,
                messagePermissions: ["text"],
            },
            params: [
                {
                    kind: "number",
                    name: "Number of messages",
                    minValue: 0,
                    maxValue: 50,
                    required: true,
                    description: "Enter the number of messages you want to create",
                    placeholder: "Number of messages",
                    choices: [],
                },
            ],
        },
        {
            name: "update_bot",
            description: "bots.update_bot.desc",
            permissions: emptyPermissions,
            devmode: true,
            params: [],
        },
        {
            name: "witch",
            description: "bots.witch.desc",
            permissions: emptyPermissions,
            params: [],
        },
    ],
};

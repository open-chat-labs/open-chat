import type { InternalBot, SlashCommandPermissions } from "openchat-shared";

export const emptyPermissions: SlashCommandPermissions = {
    chatPermissions: [],
    communityPermissions: [],
    messagePermissions: [],
    threadPermissions: [],
};

export const builtinBot: InternalBot = {
    kind: "internal_bot",
    name: "bots.builtin.name",
    description: "bots.builtin.desc",
    commands: [
        {
            name: "witch",
            description: "bots.witch.desc",
            permissions: emptyPermissions,
            params: [],
        },
        {
            name: "poll",
            description: "bots.poll.desc",
            permissions: {
                ...emptyPermissions,
                messagePermissions: ["poll"],
                threadPermissions: ["poll"],
            },
            params: [],
        },
        {
            name: "diamond",
            description: "bots.diamond.desc",
            permissions: {
                ...emptyPermissions,
                messagePermissions: ["text"],
                threadPermissions: ["text"],
            },
            params: [],
        },
        {
            name: "test-msg",
            description: "Create and send a number of test messages",
            devmode: true,
            permissions: {
                ...emptyPermissions,
                messagePermissions: ["text"],
                threadPermissions: ["text"],
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
            name: "search",
            description: "bots.search.desc",
            permissions: emptyPermissions,
            params: [
                {
                    kind: "string",
                    name: "bots.search.params.term.name",
                    minLength: 0,
                    maxLength: 100,
                    required: true,
                    description: "bots.search.params.term.desc",
                    placeholder: "bots.search.params.term.placeholder",
                    choices: [],
                },
            ],
        },
        {
            name: "gif",
            description: "bots.gif.desc",
            permissions: {
                ...emptyPermissions,
                messagePermissions: ["giphy"],
                threadPermissions: ["giphy"],
            },
            params: [
                {
                    kind: "string",
                    name: "bots.gif.params.term.name",
                    minLength: 0,
                    maxLength: 100,
                    required: true,
                    description: "bots.gif.params.term.desc",
                    placeholder: "bots.gif.params.term.placeholder",
                    choices: [],
                },
            ],
        },
        {
            name: "crypto",
            description: "bots.crypto.desc",
            permissions: {
                ...emptyPermissions,
                messagePermissions: ["crypto"],
                threadPermissions: ["crypto"],
            },
            params: [
                {
                    kind: "string",
                    name: "bots.crypto.params.token.name",
                    minLength: 0,
                    maxLength: 10,
                    required: true,
                    description: "bots.crypto.params.token.desc",
                    placeholder: "bots.crypto.params.token.placeholder",
                    choices: [],
                },
                {
                    kind: "number",
                    name: "bots.crypto.params.amount.name",
                    minValue: 0,
                    maxValue: Number.MAX_VALUE,
                    required: true,
                    description: "bots.crypto.params.amount.desc",
                    placeholder: "bots.crypto.params.amount.placeholder",
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
                threadPermissions: ["text"],
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
                            kind: "option",
                            name: "bots.faq.params.topic.choices.wallet",
                            value: "wallet",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.buychat",
                            value: "buychat",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.sendtokens",
                            value: "send_tokens",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.diamond",
                            value: "diamond",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.referral",
                            value: "referral_rewards",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.voting",
                            value: "voting",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.airdrop",
                            value: "airdrop",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.ios",
                            value: "ios_app",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.android",
                            value: "android_app",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.style",
                            value: "style_messages",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.storage",
                            value: "storage",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.security",
                            value: "security",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.info",
                            value: "info",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.shortcuts",
                            value: "shortcuts",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.content",
                            value: "content",
                        },
                        {
                            kind: "option",
                            name: "bots.faq.params.topic.choices.translation",
                            value: "translation",
                        },
                    ],
                },
            ],
        },
    ],
};

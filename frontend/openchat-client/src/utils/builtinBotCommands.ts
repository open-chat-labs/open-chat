import { type ExternalBotPermissions, type GrantedBotPermissions, type InternalBot, ROLE_MEMBER, ROLE_OWNER } from "openchat-shared";

export const emptyGrantedPermissions: GrantedBotPermissions = {
    command: {
        chatPermissions: [],
        communityPermissions: [],
        messagePermissions: [],
    },
    autonomous: undefined,
};

export const emptyPermissions: ExternalBotPermissions = {
    chatPermissions: [],
    communityPermissions: [],
    messagePermissions: [],
};

export const builtinBot: InternalBot = {
    kind: "internal_bot",
    name: "bots.builtin.name",
    definition: {
        kind: "bot_definition",
        description: "bots.builtin.desc",
        commands: [
            {
                name: "crypto",
                defaultRole: ROLE_MEMBER,
                directMessages: false,
                description: "bots.crypto.desc",
                directBotDisabled: true,
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
                        multi_line: false,
                    },
                    {
                        kind: "decimal",
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
                defaultRole: ROLE_MEMBER,
                directMessages: false,
                description: "bots.diamond.desc",
                permissions: {
                    ...emptyPermissions,
                    messagePermissions: ["text"],
                },
                params: [],
                directBotDisabled: true,
            },
            {
                name: "gif",
                defaultRole: ROLE_MEMBER,
                directMessages: false,
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
                        multi_line: false,
                    },
                ],
                directBotDisabled: true,
            },
            {
                name: "faq",
                defaultRole: ROLE_MEMBER,
                directMessages: false,
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
                        multi_line: false,
                    },
                ],
                directBotDisabled: true,
            },
            {
                name: "poll",
                defaultRole: ROLE_MEMBER,
                directMessages: false,
                description: "bots.poll.desc",
                permissions: {
                    ...emptyPermissions,
                    messagePermissions: ["poll"],
                },
                params: [],
                directBotDisabled: true,
            },
            {
                name: "register_bot",
                defaultRole: ROLE_MEMBER,
                directMessages: false,
                description: "bots.register_bot.desc",
                permissions: emptyPermissions,
                params: [],
                directBotDisabled: false,
            },
            {
                name: "register_webhook",
                defaultRole: ROLE_OWNER,
                directMessages: false,
                description: "bots.register_webhook.desc",
                permissions: emptyPermissions,
                params: [],
                directBotDisabled: true,
                directChatsDisabled: true,
            },
            {
                name: "search",
                defaultRole: ROLE_MEMBER,
                directMessages: false,
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
                        multi_line: false,
                    },
                ],
                directBotDisabled: false,
            },
            {
                name: "test-msg",
                defaultRole: ROLE_MEMBER,
                directMessages: false,
                description: "Create and send a number of test messages",
                devmode: true,
                permissions: {
                    ...emptyPermissions,
                    messagePermissions: ["text"],
                },
                params: [
                    {
                        kind: "decimal",
                        name: "Number of messages",
                        minValue: 0,
                        maxValue: 50,
                        required: true,
                        description: "Enter the number of messages you want to create",
                        placeholder: "Number of messages",
                        choices: [],
                    },
                ],
                directBotDisabled: true,
            },
            {
                name: "update_bot",
                defaultRole: ROLE_MEMBER,
                directMessages: false,
                description: "bots.update_bot.desc",
                permissions: emptyPermissions,
                params: [],
                directBotDisabled: false,
            },
            {
                name: "remove_bot",
                defaultRole: ROLE_MEMBER,
                directMessages: false,
                description: "bots.update_bot.removeDesc",
                permissions: emptyPermissions,
                params: [],
                directBotDisabled: false,
            },
            {
                name: "witch",
                defaultRole: ROLE_MEMBER,
                directMessages: false,
                description: "bots.witch.desc",
                permissions: emptyPermissions,
                params: [],
                directBotDisabled: false,
            },
        ],
        autonomousConfig: undefined,
        defaultSubscriptions: undefined,
        dataEncoding: undefined,
    },
};

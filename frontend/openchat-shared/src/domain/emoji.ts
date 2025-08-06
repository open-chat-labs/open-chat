export type NativeEmoji = {
    kind: "native";
    unicode: string;
};

export const emojiGroupNames: Record<number, string> = {
    1: "Cheap",
    2: "Worth it",
    3: "Ultimate flex",
};

export type CustomEmoji = {
    kind: "custom";
    code: string;
    url: string;
    groupId: number;
};

export type SelectedEmoji = NativeEmoji | CustomEmoji;

export const customEmojis = new Map<string, CustomEmoji>([
    [
        "cactus_bot",
        {
            kind: "custom",
            code: "cactus_bot",
            groupId: 1,
            url: "/assets/emoji/bots/cactus.svg",
        },
    ],
    [
        "cogs_bot",
        {
            kind: "custom",
            code: "cogs_bot",
            groupId: 1,
            url: "/assets/emoji/bots/cogs.svg",
        },
    ],
    [
        "dead_bot",
        {
            kind: "custom",
            code: "dead_bot",
            groupId: 1,
            url: "/assets/emoji/bots/dead.svg",
        },
    ],
    [
        "elf_bot",
        {
            kind: "custom",
            code: "elf_bot",
            groupId: 1,
            url: "/assets/emoji/bots/elf.svg",
        },
    ],
    [
        "elton_bot",
        {
            kind: "custom",
            code: "elton_bot",
            groupId: 1,
            url: "/assets/emoji/bots/elton.svg",
        },
    ],
    [
        "evil_bot",
        {
            kind: "custom",
            code: "evil_bot",
            groupId: 1,
            url: "/assets/emoji/bots/evil.svg",
        },
    ],
    [
        "ghost_bot",
        {
            kind: "custom",
            code: "ghost_bot",
            groupId: 1,
            url: "/assets/emoji/bots/ghost.svg",
        },
    ],
    [
        "goat_bot",
        {
            kind: "custom",
            code: "goat_bot",
            groupId: 1,
            url: "/assets/emoji/bots/goat_eyes.svg",
        },
    ],
    [
        "inverse_bot",
        {
            kind: "custom",
            code: "inverse_bot",
            groupId: 1,
            url: "/assets/emoji/bots/inverse.svg",
        },
    ],
    [
        "lady_bot",
        {
            kind: "custom",
            code: "lady_bot",
            groupId: 1,
            url: "/assets/emoji/bots/lady.svg",
        },
    ],
    [
        "pray_bot",
        {
            kind: "custom",
            code: "pray_bot",
            groupId: 1,
            url: "/assets/emoji/bots/pray.svg",
        },
    ],
    [
        "random_bot",
        {
            kind: "custom",
            code: "random_bot",
            groupId: 1,
            url: "/assets/emoji/bots/random.svg",
        },
    ],
    [
        "serene_bot",
        {
            kind: "custom",
            code: "serene_bot",
            groupId: 1,
            url: "/assets/emoji/bots/serene.svg",
        },
    ],
    [
        "shrug_bot",
        {
            kind: "custom",
            code: "shrug_bot",
            groupId: 1,
            url: "/assets/emoji/bots/shrug.svg",
        },
    ],
    [
        "upside_down_bot",
        {
            kind: "custom",
            code: "upside_down_bot",
            groupId: 1,
            url: "/assets/emoji/bots/upside_down.svg",
        },
    ],
    [
        "vampire_bot",
        {
            kind: "custom",
            code: "vampire_bot",
            groupId: 1,
            url: "/assets/emoji/bots/vampire.svg",
        },
    ],
    [
        "wheel_of_bots",
        {
            kind: "custom",
            code: "wheel_of_bots",
            groupId: 1,
            url: "/assets/emoji/bots/wheel.svg",
        },
    ],
    [
        "wild_bot",
        {
            kind: "custom",
            code: "wild_bot",
            groupId: 1,
            url: "/assets/emoji/bots/wild.svg",
        },
    ],
    [
        "wink_bot",
        {
            kind: "custom",
            code: "wink_bot",
            groupId: 1,
            url: "/assets/emoji/bots/wink.svg",
        },
    ],
    [
        "updates_bot",
        {
            kind: "custom",
            code: "updates_bot",
            groupId: 1,
            url: "/assets/emoji/bots/updates.svg",
        },
    ],
    [
        "this_is_fine",
        {
            kind: "custom",
            code: "this_is_fine",
            groupId: 2,
            url: "/assets/emoji/this_is_fine.gif",
        },
    ],
    [
        "party_parrot",
        {
            kind: "custom",
            code: "party_parrot",
            groupId: 2,
            url: "/assets/emoji/party_parrot.gif",
        },
    ],
    [
        "banana_dance",
        {
            kind: "custom",
            code: "banana_dance",
            groupId: 2,
            url: "/assets/emoji/banana_dance.gif",
        },
    ],
    [
        "thank_you",
        {
            kind: "custom",
            code: "thank_you",
            groupId: 2,
            url: "/assets/emoji/thank_you.gif",
        },
    ],
]);

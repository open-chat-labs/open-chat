import { describe, expect, test } from "vitest";
import {
    deletedUser,
    type BridgedUserId,
    type BridgedUserSummary,
    type ChatEvent,
    type ChatSummary,
    type EventWrapper,
    type SenderContext,
} from "../domain";
import {
    bridgedAuthorAvatarUrl,
    bridgedAuthorName,
    bridgedProfileUrl,
    bridgedUserIdsFromEvents,
    bridgedUserIdsFromLatestMessages,
    bridgedUserKey,
    isOwnMessage,
    linkedAuthor,
    shouldShowAsMe,
    tipRecipient,
} from "./bridge";

const AVATARS = "https://avatars.example.com";

describe("bridge", () => {
    const discordId: BridgedUserId = { kind: "discord", id: "80351110224678912" };
    const telegramId: BridgedUserId = { kind: "telegram", id: "123456789" };
    const discord = (
        profile: { displayName?: string; avatar?: string } = {},
    ): BridgedUserSummary => ({
        user: { kind: "discord", profile: { id: discordId.id, username: "nelly", ...profile } },
        updated: 0n,
    });
    const telegram = (photoId?: string): BridgedUserSummary => ({
        user: {
            kind: "telegram",
            profile: { id: telegramId.id, displayName: "Nelly Smith", photoId },
        },
        updated: 0n,
    });
    const twitchId: BridgedUserId = { kind: "twitch", id: "141981764" };
    const twitch = (profileImage?: string): BridgedUserSummary => ({
        user: {
            kind: "twitch",
            profile: { id: twitchId.id, login: "nelly", displayName: "Nelly", profileImage },
        },
        updated: 0n,
    });

    test("names the author from their profile, once it's fetched", () => {
        expect(bridgedAuthorName(discord())).toEqual("nelly");
        expect(bridgedAuthorName(discord({ displayName: "Nelly" }))).toEqual("Nelly");
        expect(bridgedAuthorName(telegram())).toEqual("Nelly Smith");
        expect(bridgedAuthorName(twitch())).toEqual("Nelly");
        expect(bridgedAuthorName(undefined)).toBeUndefined();
    });

    test("keys accounts by platform as well as id", () => {
        expect(bridgedUserKey(discordId)).toEqual("discord:80351110224678912");
        expect(bridgedUserKey({ kind: "telegram", id: discordId.id })).toEqual(
            "telegram:80351110224678912",
        );
        expect(bridgedUserKey(undefined)).toBeUndefined();
    });

    test("builds a Discord avatar url from the avatar hash", () => {
        expect(
            bridgedAuthorAvatarUrl(
                discordId,
                discord({ avatar: "8342729096ea3675442027381ff50dfe" }),
                AVATARS,
            ),
        ).toEqual(
            "https://cdn.discordapp.com/avatars/80351110224678912/8342729096ea3675442027381ff50dfe.png?size=128",
        );
    });

    test("falls back to Discord's default avatar picked from the id", () => {
        // (80351110224678912 >> 22) % 6 = 5
        const expected = "https://cdn.discordapp.com/embed/avatars/5.png";
        expect(bridgedAuthorAvatarUrl(discordId, discord(), AVATARS)).toEqual(expected);
        expect(bridgedAuthorAvatarUrl(discordId, undefined, AVATARS)).toEqual(expected);
    });

    test("serves a Telegram user's photo from the bridges' CDN", () => {
        expect(bridgedAuthorAvatarUrl(telegramId, telegram("AQADtLwxG5a_QEZ-"), AVATARS)).toEqual(
            "https://avatars.example.com/telegram/123456789/AQADtLwxG5a_QEZ-.jpg",
        );
        expect(bridgedAuthorAvatarUrl(telegramId, telegram(), AVATARS)).toBeUndefined();
        // Without a CDN, eg. on a test environment
        expect(
            bridgedAuthorAvatarUrl(telegramId, telegram("AQADtLwxG5a_QEZ-"), ""),
        ).toBeUndefined();
    });

    test("serves a Twitch user's profile image from Twitch's CDN", () => {
        expect(
            bridgedAuthorAvatarUrl(
                twitchId,
                twitch("jtv_user_pictures/8a6381c7-profile_image-300x300.png"),
                AVATARS,
            ),
        ).toEqual(
            "https://static-cdn.jtvnw.net/jtv_user_pictures/8a6381c7-profile_image-300x300.png",
        );
        // A generated avatar is shown in its place
        expect(bridgedAuthorAvatarUrl(twitchId, twitch(), AVATARS)).toBeUndefined();
        expect(bridgedAuthorAvatarUrl(twitchId, undefined, AVATARS)).toBeUndefined();
    });

    test("collects each account a message, or the one it replies to, was relayed from once", () => {
        const relayedFrom = (bridged?: BridgedUserId) =>
            bridged === undefined
                ? undefined
                : { kind: "bot", finalised: true, bridgedFrom: bridged };
        const message = (bridged?: BridgedUserId, replyBridged?: BridgedUserId) =>
            ({
                event: {
                    kind: "message",
                    senderContext: relayedFrom(bridged),
                    repliesTo:
                        replyBridged === undefined
                            ? undefined
                            : {
                                  kind: "rehydrated_reply_context",
                                  senderContext: relayedFrom(replyBridged),
                              },
                },
            }) as unknown as EventWrapper<ChatEvent>;

        expect(
            bridgedUserIdsFromEvents([
                message(discordId),
                message(),
                message(telegramId),
                message(discordId),
            ]),
        ).toEqual([discordId, telegramId]);
        expect(bridgedUserIdsFromEvents([message(undefined, telegramId)])).toEqual([telegramId]);
    });

    test("collects the accounts chats' latest messages were relayed from, once each", () => {
        const chat = (bridged?: BridgedUserId, hasMessage = true) =>
            ({
                latestMessage: hasMessage
                    ? {
                          event: {
                              kind: "message",
                              senderContext:
                                  bridged === undefined
                                      ? undefined
                                      : { kind: "bot", finalised: true, bridgedFrom: bridged },
                          },
                      }
                    : undefined,
            }) as unknown as ChatSummary;

        expect(
            bridgedUserIdsFromLatestMessages([
                chat(telegramId),
                chat(),
                chat(undefined, false),
                chat(discordId),
                chat(telegramId),
            ]),
        ).toEqual([telegramId, discordId]);
    });

    test("tips a relayed message to whoever linked its account, if they're in the chat", () => {
        const relayed = (bridged?: BridgedUserId) => ({
            sender: "bridge-bot",
            senderContext:
                bridged === undefined
                    ? undefined
                    : ({ kind: "bot", finalised: true, bridgedFrom: bridged } as SenderContext),
        });
        const linked = new Map([
            [bridgedUserKey(telegramId)!, { ...telegram(), linkedUserId: "alice" }],
        ]);
        const members = new Set(["alice", "bob"]);
        const isMember = (userId: string) => members.has(userId);
        const bridgeBot = { kind: "bot" } as const;

        // An ordinary message's tips go to its sender
        expect(
            tipRecipient(
                { sender: "bob", senderContext: undefined },
                { kind: "user" },
                linked,
                isMember,
            ),
        ).toBe("bob");
        expect(tipRecipient(relayed(telegramId), bridgeBot, linked, isMember)).toBe("alice");
        // No one has linked the account
        expect(tipRecipient(relayed(discordId), bridgeBot, linked, isMember)).toBeUndefined();
        expect(tipRecipient(relayed(telegramId), bridgeBot, new Map(), isMember)).toBeUndefined();
        // Whoever linked it isn't in the chat
        expect(tipRecipient(relayed(telegramId), bridgeBot, linked, () => false)).toBeUndefined();
    });

    // Invariant: only a user is tipped. A bot's or webhook's id isn't an account anyone controls.
    test("doesn't tip a message a bot or a webhook sent", () => {
        const isMember = () => true;
        const botMessage = {
            sender: "chart-bot",
            senderContext: { kind: "bot", finalised: true } as SenderContext,
        };
        const webhookMessage = {
            sender: "webhook",
            senderContext: { kind: "webhook" } as SenderContext,
        };
        // A bot that sends without a context, eg. the OpenChat bot
        const plainBotMessage = { sender: "openchat-bot", senderContext: undefined };

        expect(tipRecipient(botMessage, { kind: "bot" }, new Map(), isMember)).toBeUndefined();
        expect(tipRecipient(botMessage, undefined, new Map(), isMember)).toBeUndefined();
        expect(tipRecipient(webhookMessage, { kind: "bot" }, new Map(), isMember)).toBeUndefined();
        expect(tipRecipient(plainBotMessage, { kind: "bot" }, new Map(), isMember)).toBeUndefined();
    });

    test("shows the user who linked the account as its author, unless they've gone", () => {
        const linked = { ...telegram(), linkedUserId: "alice" };
        const alice = { ...deletedUser("alice"), updated: 1n, username: "alice" };

        expect(linkedAuthor(linked, new Map([["alice", alice]]))).toEqual(alice);
        expect(linkedAuthor(linked, new Map([["alice", deletedUser("alice")]]))).toBeUndefined();
        // Not loaded yet
        expect(linkedAuthor(linked, new Map())).toBeUndefined();
        expect(linkedAuthor(telegram(), new Map([["alice", alice]]))).toBeUndefined();
        expect(linkedAuthor(undefined, new Map([["alice", alice]]))).toBeUndefined();
    });

    test("counts a message as the user's own if they sent it or linked its account", () => {
        const fromTelegram: SenderContext = {
            kind: "bot",
            finalised: true,
            bridgedFrom: telegramId,
        };
        const bridgedUsers = (linkedUserId?: string) =>
            new Map([[bridgedUserKey(telegramId)!, { ...telegram(), linkedUserId }]]);

        expect(isOwnMessage({ sender: "me" }, "me", new Map())).toBe(true);
        expect(isOwnMessage({ sender: "them" }, "me", new Map())).toBe(false);
        expect(
            isOwnMessage(
                { sender: "bridge", senderContext: fromTelegram },
                "me",
                bridgedUsers("me"),
            ),
        ).toBe(true);
        expect(
            isOwnMessage(
                { sender: "bridge", senderContext: fromTelegram },
                "me",
                bridgedUsers("them"),
            ),
        ).toBe(false);
        expect(
            isOwnMessage({ sender: "bridge", senderContext: fromTelegram }, "me", bridgedUsers()),
        ).toBe(false);
        // Its profile not fetched yet
        expect(
            isOwnMessage({ sender: "bridge", senderContext: fromTelegram }, "me", new Map()),
        ).toBe(false);
    });

    test("links to a Discord or Twitch account's profile, and a Telegram account's if it has a username", () => {
        expect(
            bridgedProfileUrl({
                kind: "telegram",
                profile: { id: telegramId.id, username: "nelly", displayName: "Nelly" },
            }),
        ).toEqual("https://t.me/nelly");
        expect(
            bridgedProfileUrl({
                kind: "telegram",
                profile: { id: telegramId.id, displayName: "Nelly" },
            }),
        ).toBeUndefined();
        expect(bridgedProfileUrl(discord().user)).toEqual(
            "https://discord.com/users/80351110224678912",
        );
        expect(bridgedProfileUrl(twitch().user)).toEqual("https://www.twitch.tv/nelly");
    });
});

describe("shouldShowAsMe", () => {
    test("a message the user sent is theirs", () => {
        expect(shouldShowAsMe(true, undefined, "me")).toBe(true);
    });

    test("a message relayed from an account the user linked is shown as theirs", () => {
        expect(shouldShowAsMe(false, "me", "me")).toBe(true);
    });

    test("a message relayed from someone else's account, or an unlinked one, isn't", () => {
        expect(shouldShowAsMe(false, "them", "me")).toBe(false);
        expect(shouldShowAsMe(false, undefined, "me")).toBe(false);
    });
});

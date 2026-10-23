import { describe, expect, test } from "vitest";
import {
    deletedUser,
    type BridgedUserId,
    type BridgedUserSummary,
    type ChatEvent,
    type EventWrapper,
    type SenderContext,
} from "../domain";
import {
    bridgedAuthorAvatarUrl,
    bridgedAuthorName,
    bridgedProfileUrl,
    bridgedUserIdsFromEvents,
    bridgedUserKey,
    isOwnMessage,
    linkedAuthor,
    shouldShowAsMe,
} from "./bridge";

const PATTERN = "https://{canisterId}.raw.icp0.io/{blobType}";

describe("bridge", () => {
    const discordId: BridgedUserId = { kind: "discord", id: "80351110224678912" };
    const telegramId: BridgedUserId = { kind: "telegram", id: "123456789" };
    const discord = (
        profile: { displayName?: string; avatar?: string } = {},
    ): BridgedUserSummary => ({
        user: { kind: "discord", profile: { id: discordId.id, username: "nelly", ...profile } },
        updated: 0n,
    });
    const telegram = (avatar?: { canisterId: string; blobId: bigint }): BridgedUserSummary => ({
        user: {
            kind: "telegram",
            profile: { id: telegramId.id, displayName: "Nelly Smith", avatar },
        },
        updated: 0n,
    });

    test("names the author from their profile, once it's fetched", () => {
        expect(bridgedAuthorName(discord())).toEqual("nelly");
        expect(bridgedAuthorName(discord({ displayName: "Nelly" }))).toEqual("Nelly");
        expect(bridgedAuthorName(telegram())).toEqual("Nelly Smith");
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
                PATTERN,
            ),
        ).toEqual(
            "https://cdn.discordapp.com/avatars/80351110224678912/8342729096ea3675442027381ff50dfe.png?size=128",
        );
    });

    test("falls back to Discord's default avatar picked from the id", () => {
        // (80351110224678912 >> 22) % 6 = 5
        const expected = "https://cdn.discordapp.com/embed/avatars/5.png";
        expect(bridgedAuthorAvatarUrl(discordId, discord(), PATTERN)).toEqual(expected);
        expect(bridgedAuthorAvatarUrl(discordId, undefined, PATTERN)).toEqual(expected);
    });

    test("serves a Telegram avatar from OpenChat's storage", () => {
        expect(
            bridgedAuthorAvatarUrl(
                telegramId,
                telegram({ canisterId: "rturd-qaaaa-aaaaf-aabaq-cai", blobId: 7n }),
                PATTERN,
            ),
        ).toEqual("https://rturd-qaaaa-aaaaf-aabaq-cai.raw.icp0.io/blobs/7");
        expect(bridgedAuthorAvatarUrl(telegramId, telegram(), PATTERN)).toBeUndefined();
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

    test("a Telegram account's profile page needs a username", () => {
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
        expect(bridgedProfileUrl(discord().user)).toBeUndefined();
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

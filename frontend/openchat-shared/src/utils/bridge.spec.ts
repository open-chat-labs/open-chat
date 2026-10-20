import { describe, expect, test } from "vitest";
import type { BridgedUserId, BridgedUserSummary, ChatEvent, EventWrapper } from "../domain";
import {
    bridgedAuthorAvatarUrl,
    bridgedAuthorName,
    bridgedUserIdsFromEvents,
    bridgedUserKey,
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

    test("collects each account a message was relayed from once", () => {
        const message = (bridged?: BridgedUserId) =>
            ({
                event: {
                    kind: "message",
                    senderContext:
                        bridged === undefined
                            ? undefined
                            : { kind: "bot", finalised: true, bridgedFrom: bridged },
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
    });
});

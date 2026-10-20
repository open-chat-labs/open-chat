import { describe, expect, test } from "vitest";
import type { BridgedFrom } from "../domain";
import { bridgedAuthorAvatarUrl, bridgedAuthorKey, bridgedAuthorName } from "./bridge";

const PATTERN = "https://{canisterId}.raw.icp0.io/{blobType}";

describe("bridge", () => {
    const discord = (author: Partial<Extract<BridgedFrom, { kind: "discord" }>["author"]> = {}) =>
        ({
            kind: "discord",
            author: { id: "80351110224678912", username: "nelly", ...author },
        }) as BridgedFrom;
    const telegram = (author: Partial<Extract<BridgedFrom, { kind: "telegram" }>["author"]> = {}) =>
        ({
            kind: "telegram",
            author: { id: "123456789", displayName: "Nelly Smith", ...author },
        }) as BridgedFrom;

    test("names the author by their display name if they have one", () => {
        expect(bridgedAuthorName(discord())).toEqual("nelly");
        expect(bridgedAuthorName(discord({ displayName: "Nelly" }))).toEqual("Nelly");
        expect(bridgedAuthorName(telegram())).toEqual("Nelly Smith");
    });

    test("keys authors by platform as well as id", () => {
        expect(bridgedAuthorKey(discord())).toEqual("discord:80351110224678912");
        expect(bridgedAuthorKey(telegram({ id: "80351110224678912" }))).toEqual(
            "telegram:80351110224678912",
        );
        expect(bridgedAuthorKey(undefined)).toBeUndefined();
    });

    test("builds a Discord avatar url from the avatar hash", () => {
        expect(
            bridgedAuthorAvatarUrl(
                discord({ avatar: "8342729096ea3675442027381ff50dfe" }),
                PATTERN,
            ),
        ).toEqual(
            "https://cdn.discordapp.com/avatars/80351110224678912/8342729096ea3675442027381ff50dfe.png?size=128",
        );
    });

    test("falls back to Discord's default avatar picked from the id", () => {
        // (80351110224678912 >> 22) % 6 = 5
        expect(bridgedAuthorAvatarUrl(discord(), PATTERN)).toEqual(
            "https://cdn.discordapp.com/embed/avatars/5.png",
        );
    });

    test("serves a Telegram avatar from OpenChat's storage", () => {
        expect(
            bridgedAuthorAvatarUrl(
                telegram({ avatar: { canisterId: "rturd-qaaaa-aaaaf-aabaq-cai", blobId: 7n } }),
                PATTERN,
            ),
        ).toEqual("https://rturd-qaaaa-aaaaf-aabaq-cai.raw.icp0.io/blobs/7");
        expect(bridgedAuthorAvatarUrl(telegram(), PATTERN)).toBeUndefined();
    });
});

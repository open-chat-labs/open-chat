import { describe, expect, test } from "vitest";
import { discordAvatarUrl, discordDisplayName } from "./discord";

describe("discord", () => {
    const user = { id: "80351110224678912", username: "nelly" };

    test("uses the display name if there is one", () => {
        expect(discordDisplayName(user)).toEqual("nelly");
        expect(discordDisplayName({ ...user, displayName: "Nelly" })).toEqual("Nelly");
    });

    test("builds the avatar url from the avatar hash", () => {
        expect(discordAvatarUrl({ ...user, avatar: "8342729096ea3675442027381ff50dfe" })).toEqual(
            "https://cdn.discordapp.com/avatars/80351110224678912/8342729096ea3675442027381ff50dfe.png?size=128",
        );
    });

    test("falls back to Discord's default avatar picked from the id", () => {
        // (80351110224678912 >> 22) % 6 = 5
        expect(discordAvatarUrl(user)).toEqual("https://cdn.discordapp.com/embed/avatars/5.png");
    });
});

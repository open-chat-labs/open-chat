import type { BridgedUserSummary } from "@client";
import { bridgedAccountRows } from "./bridgedAccounts";

const telegramAccount: BridgedUserSummary = {
    user: { kind: "telegram", profile: { id: "42", displayName: "Nelly" } },
    linkedUserId: "abc",
    updated: BigInt(0),
};

const discordAccount: BridgedUserSummary = {
    user: { kind: "discord", profile: { id: "123", username: "nelly" } },
    linkedUserId: "abc",
    updated: BigInt(0),
};

const twitchAccount: BridgedUserSummary = {
    user: { kind: "twitch", profile: { id: "141981764", login: "nelly", displayName: "Nelly" } },
    linkedUserId: "abc",
    updated: BigInt(0),
};

describe("bridgedAccountRows", () => {
    test("has a row per platform, Telegram first, while the accounts load", () => {
        expect(bridgedAccountRows(undefined, ["discord", "telegram", "twitch"])).toEqual([
            { kind: "loading", platform: "telegram" },
            { kind: "loading", platform: "discord" },
            { kind: "loading", platform: "twitch" },
        ]);
    });

    test("offers every linkable platform when nothing is linked", () => {
        expect(bridgedAccountRows([], ["discord", "telegram", "twitch"])).toEqual([
            { kind: "linkable", platform: "telegram" },
            { kind: "linkable", platform: "discord" },
            { kind: "linkable", platform: "twitch" },
        ]);
    });

    test("shows a platform's linked account in place of its link", () => {
        expect(bridgedAccountRows([telegramAccount], ["discord", "telegram", "twitch"])).toEqual([
            { kind: "linked", platform: "telegram", account: telegramAccount },
            { kind: "linkable", platform: "discord" },
            { kind: "linkable", platform: "twitch" },
        ]);
        expect(
            bridgedAccountRows(
                [twitchAccount, discordAccount, telegramAccount],
                ["discord", "telegram", "twitch"],
            ),
        ).toEqual([
            { kind: "linked", platform: "telegram", account: telegramAccount },
            { kind: "linked", platform: "discord", account: discordAccount },
            { kind: "linked", platform: "twitch", account: twitchAccount },
        ]);
    });

    test("keeps the row of a platform which can't be linked", () => {
        expect(bridgedAccountRows([], ["telegram"])).toEqual([
            { kind: "linkable", platform: "telegram" },
            { kind: "unavailable", platform: "discord" },
            { kind: "unavailable", platform: "twitch" },
        ]);
        expect(bridgedAccountRows([discordAccount], ["telegram"])).toEqual([
            { kind: "linkable", platform: "telegram" },
            { kind: "linked", platform: "discord", account: discordAccount },
            { kind: "unavailable", platform: "twitch" },
        ]);
    });
});

import type { BridgedUserSummary } from "@client";
import { platformsToLink } from "./bridgedAccounts";

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

describe("platformsToLink", () => {
    test("offers every linkable platform when nothing is linked", () => {
        expect(platformsToLink([], ["discord", "telegram"])).toEqual(["discord", "telegram"]);
    });

    test("doesn't offer a platform with an account linked", () => {
        expect(platformsToLink([telegramAccount], ["discord", "telegram"])).toEqual(["discord"]);
        expect(platformsToLink([telegramAccount, discordAccount], ["discord", "telegram"])).toEqual(
            [],
        );
    });

    test("only offers platforms which are linkable", () => {
        expect(platformsToLink([], ["telegram"])).toEqual(["telegram"]);
        expect(platformsToLink([discordAccount], ["telegram"])).toEqual(["telegram"]);
    });
});

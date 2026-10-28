import { describe, expect, test } from "vitest";
import { jwtExpiryMs } from "./jwt";

function token(payload: object): string {
    const base64url = btoa(JSON.stringify(payload))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    return `header.${base64url}.signature`;
}

describe("jwtExpiryMs", () => {
    test("reads exp, in seconds, as milliseconds, from unpadded base64url", () => {
        expect(
            jwtExpiryMs(token({ exp: 1_790_000_000, claim_type: "BotMessageSession", s: "?>" })),
        ).toBe(1_790_000_000_000);
    });

    test("is undefined without a numeric exp, or for something which isn't a JWT", () => {
        expect(jwtExpiryMs(token({ claim_type: "BotMessageSession" }))).toBeUndefined();
        expect(jwtExpiryMs(token({ exp: "soon" }))).toBeUndefined();
        expect(jwtExpiryMs("not a token")).toBeUndefined();
        expect(jwtExpiryMs("a.!!!.c")).toBeUndefined();
    });
});

import { describe, expect, test } from "vitest";
import { postLoginCreateCommunity } from "./join";

describe("postLoginCreateCommunity", () => {
    test("picks up creating a community once the user who asked for it has logged in", () => {
        expect(
            postLoginCreateCommunity({
                kind: "logged_in",
                postLogin: { kind: "create_community" },
            }),
        ).toBe(true);
    });

    test("waits while the user is still logging in", () => {
        expect(
            postLoginCreateCommunity({
                kind: "logging_in",
                postLogin: { kind: "create_community" },
            }),
        ).toBe(false);
    });

    test("does nothing for another operation, or none", () => {
        expect(
            postLoginCreateCommunity({ kind: "logged_in", postLogin: { kind: "create_group" } }),
        ).toBe(false);
        expect(postLoginCreateCommunity({ kind: "logged_in" })).toBe(false);
    });
});

import { describe, expect, test } from "vitest";
import { postLoginCreateCommunity, postLoginPath } from "./join";

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

describe("postLoginPath", () => {
    const continueTo = { kind: "continue_to", path: "/wallet?token=abc" } as const;

    test("goes on to the page a guest was going to once they have logged in", () => {
        expect(postLoginPath({ kind: "logged_in", postLogin: continueTo })).toBe(
            "/wallet?token=abc",
        );
    });

    test("waits while they're still signing in or making their account", () => {
        expect(postLoginPath({ kind: "logging_in", postLogin: continueTo })).toBeUndefined();
        expect(postLoginPath({ kind: "registering", postLogin: continueTo })).toBeUndefined();
        expect(
            postLoginPath({ kind: "loading_user", registering: false, postLogin: continueTo }),
        ).toBeUndefined();
    });

    test("is none for another operation, or none", () => {
        expect(
            postLoginPath({ kind: "logged_in", postLogin: { kind: "create_community" } }),
        ).toBeUndefined();
        expect(postLoginPath({ kind: "logged_in" })).toBeUndefined();
    });
});

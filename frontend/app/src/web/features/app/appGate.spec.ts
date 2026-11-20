import { describe, expect, test } from "vitest";
import { appGate } from "./appGate";

describe("appGate", () => {
    test("a spinner while the user loads or their chats haven't arrived", () => {
        expect(appGate({ kind: "loading_user", registering: false }, false, false)).toBe(
            "loading",
        );
        expect(appGate({ kind: "loading_user", registering: false }, true, false)).toBe("loading");
        expect(appGate({ kind: "logged_in" }, false, false)).toBe("loading");
    });

    test("an error with Retry in its place when start-up failed", () => {
        expect(appGate({ kind: "loading_user", registering: false }, false, true)).toBe("failed");
        // an anonymous session whose set-up failed never gets its chats either
        expect(appGate({ kind: "anon" }, false, true)).toBe("failed");
    });

    test("the app once there's a user and their chats", () => {
        expect(appGate({ kind: "logged_in" }, true, false)).toBe("app");
        // a stale failure doesn't hold back a user who's since loaded
        expect(appGate({ kind: "logged_in" }, true, true)).toBe("app");
    });

    test("an identity without an account goes on to sign-up", () => {
        expect(appGate({ kind: "registering" }, false, true)).toBe("app");
        expect(appGate({ kind: "loading_user", registering: true }, false, false)).toBe("app");
    });
});

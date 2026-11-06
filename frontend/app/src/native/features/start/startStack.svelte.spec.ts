import { StartStack, startEntry, startPath, startStepFor } from "./startStack.svelte";

describe("the signed-out start's stack", () => {
    test("goes deeper by pushing, and back by popping", () => {
        const start = new StartStack();
        expect(start.steps).toEqual(["welcome"]);
        expect(start.canGoBack).toBe(false);
        start.go("welcome_back");
        expect(start.change).toBe("push");
        start.go("link");
        expect(start.steps).toEqual(["welcome", "welcome_back", "link"]);
        expect(start.change).toBe("push");
        start.back();
        expect(start.steps).toEqual(["welcome", "welcome_back"]);
        expect(start.change).toBe("pop");
        start.back();
        start.back();
        expect(start.steps).toEqual(["welcome"]);
    });

    test("Create an account from Welcome back replaces it, so Back goes to Welcome", () => {
        const start = new StartStack();
        start.go("welcome_back");
        start.go("sign_up");
        expect(start.change).toBe("replace");
        expect(start.steps).toEqual(startPath("sign_up"));
        start.back();
        expect(start.top).toBe("welcome");
    });

    test("starts again without motion", () => {
        const start = new StartStack();
        start.go("sign_up");
        start.reset("welcome");
        expect(start.steps).toEqual(["welcome"]);
        expect(start.change).toBe("none");
    });

    test("opens at Pick a username for an identity without an account", () => {
        expect(startStepFor({ kind: "registering" })).toBe("sign_up");
        expect(startStepFor({ kind: "loading_user", registering: true })).toBe("sign_up");
        expect(startStepFor({ kind: "anon" })).toBe("welcome");
    });
});

describe("what the native tree shows", () => {
    test("the start for someone signed out, or signing in or up there", () => {
        expect(startEntry({ kind: "anon" }, true, false)).toBe("start");
        expect(startEntry({ kind: "registering" }, true, false)).toBe("start");
        expect(startEntry({ kind: "loading_user", registering: true }, true, false)).toBe("start");
        // a passkey sign-in from the start loads the user with the start still showing
        expect(startEntry({ kind: "loading_user", registering: false }, true, true)).toBe("start");
    });

    test("a spinner while a session from before loads, rather than Welcome", () => {
        expect(startEntry({ kind: "loading_user", registering: false }, true, false)).toBe(
            "loading",
        );
    });

    test("the app once there's a user", () => {
        expect(startEntry({ kind: "logged_in" }, false, true)).toBe("app");
        expect(startEntry({ kind: "logged_in" }, false, false)).toBe("app");
    });
});

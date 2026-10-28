import { describe, expect, test } from "vitest";
import { miniAppMessage, miniAppUrl } from "./miniApp";

const OPENCHAT = "https://oc.app";

describe("miniAppUrl", () => {
    test("is the bot's endpoint with /app, whether or not the endpoint ends in a slash", () => {
        expect(miniAppUrl("https://uno.example.com", OPENCHAT)?.href).toBe(
            "https://uno.example.com/app",
        );
        expect(miniAppUrl("https://bots.example.com/uno/", OPENCHAT)?.href).toBe(
            "https://bots.example.com/uno/app",
        );
    });

    test("allows http only for a bot run on this machine", () => {
        expect(miniAppUrl("http://localhost:4000", OPENCHAT)?.href).toBe(
            "http://localhost:4000/app",
        );
        expect(miniAppUrl("http://127.0.0.1:4000", OPENCHAT)).toBeDefined();
        expect(miniAppUrl("http://uno.example.com", OPENCHAT)).toBeUndefined();
    });

    test.each(["javascript:alert(1)", "data:text/html,hi", "not a url", ""])(
        "refuses %s",
        (url) => {
            expect(miniAppUrl(url, OPENCHAT)).toBeUndefined();
        },
    );

    // A frame allowed scripts and its own origin could reach into OpenChat's pages
    test("refuses OpenChat's own origin", () => {
        expect(miniAppUrl("https://oc.app/bots/uno", OPENCHAT)).toBeUndefined();
    });
});

describe("miniAppMessage", () => {
    const frame = {} as MessageEventSource;
    const from = (
        data: unknown,
        source: MessageEventSource | null = frame,
        origin = "https://uno.example.com",
    ) =>
        miniAppMessage(
            new MessageEvent("message", { data, source, origin }),
            frame,
            "https://uno.example.com",
        );

    test("accepts the app's messages from its frame", () => {
        expect(from({ kind: "mini_app_ready" })).toEqual({ kind: "mini_app_ready" });
        expect(from({ kind: "mini_app_token_request", extra: 1 })).toEqual({
            kind: "mini_app_token_request",
        });
    });

    test("ignores anything from another window or origin, or that isn't the app's", () => {
        expect(from({ kind: "mini_app_ready" }, {} as MessageEventSource)).toBeUndefined();
        expect(from({ kind: "mini_app_ready" }, null)).toBeUndefined();
        expect(from({ kind: "mini_app_ready" }, frame, "https://evil.example.com")).toBeUndefined();
        expect(from({ kind: "initialise_mini_app" })).toBeUndefined();
        expect(from("mini_app_ready")).toBeUndefined();
        expect(from(null)).toBeUndefined();
    });
});

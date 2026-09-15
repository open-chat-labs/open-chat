import { describe, expect, test } from "vitest";
import {
    EXTERNAL_CONTENT_SANDBOX,
    externalContentOrigin,
    isExternalContentReady,
} from "./externalContent";

describe("externalContentOrigin", () => {
    // Invariant: the website only frames https external URLs.
    test("returns the origin for an https url", () => {
        expect(externalContentOrigin("https://dapp.example.com/path?x=1")).toBe(
            "https://dapp.example.com",
        );
    });

    // Invariant: the website only frames https external URLs.
    test.each([
        "http://dapp.example.com",
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "blob:https://oc.app/abc",
        "about:blank",
        "not a url",
        "",
        undefined,
    ])("refuses %s", (url) => {
        expect(externalContentOrigin(url)).toBeUndefined();
    });
});

describe("EXTERNAL_CONTENT_SANDBOX", () => {
    // Invariant: a framed site can never navigate the OpenChat window, trigger downloads
    // or open modal dialogs.
    test("never grants top navigation, downloads or modals", () => {
        const flags = EXTERNAL_CONTENT_SANDBOX.split(" ");
        for (const flag of flags) {
            expect(flag).not.toMatch(/^allow-top-navigation/);
        }
        expect(flags).not.toContain("allow-downloads");
        expect(flags).not.toContain("allow-modals");
    });
});

describe("isExternalContentReady", () => {
    const origin = "https://dapp.example.com";
    const ready = { kind: "external_content_ready" };

    // Invariant: the host reacts to exactly one message kind, from the framed origin only.
    test("accepts the ready message from the framed origin", () => {
        expect(
            isExternalContentReady(new MessageEvent("message", { origin, data: ready }), origin),
        ).toBe(true);
    });

    // Invariant: the host reacts to exactly one message kind, from the framed origin only.
    test.each<[string, MessageEventInit]>([
        ["another origin", { origin: "https://evil.example.com", data: ready }],
        ["a null origin", { origin: "null", data: ready }],
        ["another kind", { origin, data: { kind: "set_theme" } }],
        ["null data", { origin, data: null }],
        ["a string", { origin, data: "external_content_ready" }],
        ["no data", { origin }],
    ])("ignores %s", (_, init) => {
        expect(isExternalContentReady(new MessageEvent("message", init), origin)).toBe(false);
    });
});

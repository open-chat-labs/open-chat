import { afterEach, describe, expect, test, vi } from "vitest";
import { MEME_MAKER_ORIGIN, guardMemeFighterMessages } from "./memeFighter";

describe("guardMemeFighterMessages", () => {
    let remove: (() => void) | undefined;
    afterEach(() => remove?.());

    function post(init: MessageEventInit) {
        window.dispatchEvent(new MessageEvent("message", init));
    }

    test("the maker origin is https", () => {
        expect(MEME_MAKER_ORIGIN).toMatch(/^https:\/\//);
    });

    // Invariant: a Meme Fighter protocol message from any origin other than the maker never
    // reaches a listener registered after the guard.
    test("drops protocol messages from other origins", () => {
        remove = guardMemeFighterMessages();
        const later = vi.fn();
        window.addEventListener("message", later);
        post({
            origin: "https://evil.example.com",
            data: { messageType: "MEME_CREATED", payload: "x" },
        });
        post({ origin: "null", data: { messageType: "READY" } });
        expect(later).not.toHaveBeenCalled();
        window.removeEventListener("message", later);
    });

    // Invariant: the guard only affects Meme Fighter protocol messages.
    test("passes the maker's own messages and unrelated messages", () => {
        remove = guardMemeFighterMessages();
        const later = vi.fn();
        window.addEventListener("message", later);
        post({ origin: MEME_MAKER_ORIGIN, data: { messageType: "READY" } });
        post({ origin: "https://other.example.com", data: { kind: "external_content_ready" } });
        post({ origin: "https://other.example.com", data: null });
        expect(later).toHaveBeenCalledTimes(3);
        window.removeEventListener("message", later);
    });

    test("stops guarding once removed", () => {
        remove = guardMemeFighterMessages();
        remove();
        remove = undefined;
        const later = vi.fn();
        window.addEventListener("message", later);
        post({ origin: "https://evil.example.com", data: { messageType: "MEME_CREATED" } });
        expect(later).toHaveBeenCalledTimes(1);
        window.removeEventListener("message", later);
    });
});

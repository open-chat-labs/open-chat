import type { SendMessageOutcome } from "@client";
import { toastStore } from "@src/stores/toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { clearsEntry } from "./sendFromEntry";

describe("a message entry waiting for its send", () => {
    afterEach(() => vi.restoreAllMocks());

    const outcome = (kind: SendMessageOutcome["kind"]) =>
        Promise.resolve({ kind } as SendMessageOutcome);

    /** Invariant: the legacy entries clear their text only once the message shows in the chat;
     * refused before sending, the text stays. */
    test("clears only once posted", async () => {
        const sending = vi.fn();
        expect(await clearsEntry(outcome("posted"), sending)).toBe(true);
        for (const kind of [
            "rules_declined",
            "pin_cancelled",
            "throttled",
            "busy",
            "failed",
        ] as const) {
            expect(await clearsEntry(outcome(kind), sending)).toBe(false);
        }
    });

    test("an edit, with nothing to wait for, clears at once", async () => {
        const sending = vi.fn();
        expect(await clearsEntry("nothing_sent", sending)).toBe(true);
        expect(sending).not.toHaveBeenCalled();
    });

    test("is sending while it waits, and says when a send failed", async () => {
        const toast = vi.spyOn(toastStore, "showFailureToast").mockImplementation(() => {});
        const sending = vi.fn();
        await clearsEntry(outcome("failed"), sending);
        expect(sending.mock.calls).toEqual([[true], [false]]);
        expect(toast).toHaveBeenCalledOnce();
        await clearsEntry(outcome("rules_declined"), sending);
        expect(toast).toHaveBeenCalledOnce();
    });
});

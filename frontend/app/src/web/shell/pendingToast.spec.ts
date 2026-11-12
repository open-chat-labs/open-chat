import { i18nKey, type MessageFormatter } from "@client";
import type { HostedToast, PendingToastHost } from "@openchat/ui/src/lib/toasts.svelte";
import { describe, expect, test, vi } from "vitest";
import { runInPendingToast, SETTLED_TOAST_MS, settledToast } from "./pendingToast";

// the key and its params, as the words
const formatter: MessageFormatter = (id, options) =>
    `${id}${options?.values ? ` ${JSON.stringify(options.values)}` : ""}`;

describe("a pending toast's outcome", () => {
    test("a success has the check and goes by itself", () => {
        expect(
            settledToast(
                { kind: "success", message: i18nKey("moderationToast.unfrozen", { name: "Club" }) },
                formatter,
            ),
        ).toEqual({
            message: 'moderationToast.unfrozen {"name":"Club"}',
            tone: "success",
            icon: "check",
            duration: SETTLED_TOAST_MS,
        });
    });

    test("a failure stays until it's closed, and offers no action", () => {
        const toast = settledToast(
            {
                kind: "failed",
                message: i18nKey("moderationToast.unfreezeFailed", { name: "Club" }),
            },
            formatter,
        );
        expect(toast).toEqual({
            message: 'moderationToast.unfreezeFailed {"name":"Club"}',
            icon: "none",
        });
        expect(toast.duration).toBeUndefined();
        expect(toast.onAction).toBeUndefined();
    });
});

describe("running an action in a pending toast", () => {
    test("says it's on its way first, then settles to how it went", async () => {
        const settle = vi.fn((_: HostedToast) => () => {});
        const host = vi.fn<PendingToastHost>(() => ({ settle }));
        let finish: (ok: boolean) => void = () => {};
        const done = runInPendingToast(
            host,
            {
                pending: i18nKey("moderationToast.unsuspending", { username: "alice" }),
                run: () =>
                    new Promise((resolve) => {
                        finish = (ok) =>
                            resolve(
                                ok
                                    ? {
                                          kind: "success",
                                          message: i18nKey("moderationToast.unsuspended"),
                                      }
                                    : {
                                          kind: "failed",
                                          message: i18nKey("moderationToast.unsuspendFailed"),
                                      },
                            );
                    }),
            },
            formatter,
        );
        expect(host).toHaveBeenCalledWith({
            message: 'moderationToast.unsuspending {"username":"alice"}',
            icon: "none",
        });
        expect(settle).not.toHaveBeenCalled();
        finish(true);
        await done;
        expect(settle).toHaveBeenCalledWith(
            expect.objectContaining({ message: "moderationToast.unsuspended", tone: "success" }),
        );
    });
});

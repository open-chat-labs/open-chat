import { i18nKey, type ToastOutcome } from "@client";
import { describe, expect, test } from "vitest";
import { PendingAction } from "./pendingAction.svelte";

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

const failed: ToastOutcome = { kind: "failed", message: i18nKey("failedToFreezeGroup") };
const done: ToastOutcome = { kind: "success", message: i18nKey("chatFrozen") };

describe("a moderation dialog's pending action", () => {
    test("is busy until the backend answers, and hands a success back", async () => {
        const action = new PendingAction();
        const call = deferred<ToastOutcome>();
        const running = action.run(() => call.promise);
        expect(action.busy).toBe(true);
        expect(action.error).toBeUndefined();
        call.resolve(done);
        expect(await running).toEqual(done);
        expect(action.busy).toBe(false);
        expect(action.error).toBeUndefined();
    });

    test("ignores a second press while it runs", async () => {
        const action = new PendingAction();
        const call = deferred<ToastOutcome>();
        let calls = 0;
        const run = () =>
            action.run(() => {
                calls++;
                return call.promise;
            });
        const first = run();
        expect(await run()).toBeUndefined();
        call.resolve(done);
        await first;
        expect(calls).toBe(1);
    });

    test("keeps a failure to show inline, and clears it on the next try", async () => {
        const action = new PendingAction();
        expect(await action.run(() => Promise.resolve(failed))).toBeUndefined();
        expect(action.busy).toBe(false);
        expect(action.error).toEqual(i18nKey("failedToFreezeGroup"));
        const retry = deferred<ToastOutcome>();
        const running = action.run(() => retry.promise);
        expect(action.error).toBeUndefined();
        retry.resolve(done);
        expect(await running).toEqual(done);
    });
});

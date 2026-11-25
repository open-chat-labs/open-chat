import { publish } from "@shared";
import { afterEach, describe, expect, test, vi } from "vitest";

const { broadcastLoggedInUser, recordError, showFailureToast } = vi.hoisted(() => ({
    broadcastLoggedInUser: vi.fn(),
    recordError: vi.fn(),
    showFailureToast: vi.fn(),
}));

vi.mock("@client", async () => {
    const shared = await import("@shared");
    // the client's store as the helper uses it: subscribe, set and its value
    let value = false;
    const subscribers = new Set<(v: boolean) => void>();
    return {
        subscribe: shared.subscribe,
        i18nKey: shared.i18nKey,
        inititaliseLogger: vi.fn(),
        signUpInterruptedStore: {
            subscribe(fn: (v: boolean) => void) {
                subscribers.add(fn);
                fn(value);
                return () => subscribers.delete(fn);
            },
            set(next: boolean) {
                value = next;
                subscribers.forEach((fn) => fn(next));
            },
            get value() {
                return value;
            },
        },
    };
});
vi.mock("@stores/xframe", () => ({ broadcastLoggedInUser }));
vi.mock("@stores/toast", () => ({ toastStore: { showFailureToast } }));
vi.mock("@utils/errorPostmortem", () => ({ recordError }));

import { signUpInterruptedStore, type Logger, type OpenChat } from "@client";
import {
    boundaryErrorHandler,
    sayWhenSignUpInterrupted,
    subscribeToSessionEvents,
} from "./appRoot.svelte";

describe("the session events every App root handles", () => {
    const client = { logout: vi.fn() } as unknown as OpenChat;
    let unsubscribe = () => {};

    afterEach(() => {
        unsubscribe();
        vi.clearAllMocks();
    });

    test("a login runs the tree's own handler, then is broadcast", () => {
        const onLoggedIn = vi.fn();
        unsubscribe = subscribeToSessionEvents(client, { onLoggedIn });
        publish("userLoggedIn", "user-1");
        expect(onLoggedIn).toHaveBeenCalledWith("user-1");
        expect(broadcastLoggedInUser).toHaveBeenCalledWith("user-1");
        expect(onLoggedIn.mock.invocationCallOrder[0]).toBeLessThan(
            broadcastLoggedInUser.mock.invocationCallOrder[0],
        );
    });

    test("a login is broadcast without a handler of the tree's own", () => {
        unsubscribe = subscribeToSessionEvents(client);
        publish("userLoggedIn", "user-1");
        expect(broadcastLoggedInUser).toHaveBeenCalledWith("user-1");
    });

    test("an expired session logs out", () => {
        unsubscribe = subscribeToSessionEvents(client);
        publish("sessionExpired");
        expect(client.logout).toHaveBeenCalled();
    });

    test("a new user id runs the tree's restart", () => {
        const onUserIdChanged = vi.fn();
        unsubscribe = subscribeToSessionEvents(client, { onUserIdChanged });
        publish("currentUserIdChanged");
        expect(onUserIdChanged).toHaveBeenCalled();
    });

    test("nothing is handled after unsubscribing", () => {
        subscribeToSessionEvents(client)();
        publish("userLoggedIn", "user-1");
        publish("sessionExpired");
        expect(broadcastLoggedInUser).not.toHaveBeenCalled();
        expect(client.logout).not.toHaveBeenCalled();
    });
});

describe("a sign-up interrupted by a reload (#10596)", () => {
    afterEach(() => {
        vi.clearAllMocks();
        signUpInterruptedStore.set(false);
    });

    test("is said once, as a failure toast", () => {
        const stop = sayWhenSignUpInterrupted();
        expect(showFailureToast).not.toHaveBeenCalled();

        signUpInterruptedStore.set(true);
        expect(showFailureToast).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ key: "signUpInterrupted" }),
        );
        expect(signUpInterruptedStore.value).toBe(false);
        stop();
    });

    test("one from before the root mounted is said too", () => {
        signUpInterruptedStore.set(true);
        const stop = sayWhenSignUpInterrupted();
        expect(showFailureToast).toHaveBeenCalledOnce();
        stop();
    });
});

describe("the root's boundary error handler", () => {
    test("records the error and logs it", () => {
        const logger = { error: vi.fn() } as unknown as Logger;
        const err = new Error("boom");
        boundaryErrorHandler(logger)(err);
        expect(recordError).toHaveBeenCalledWith("boundary", err);
        expect(logger.error).toHaveBeenCalledWith("Top level boundary error: ", err);
    });
});

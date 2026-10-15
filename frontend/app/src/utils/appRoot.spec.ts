import { publish } from "@shared";
import { afterEach, describe, expect, test, vi } from "vitest";

const { broadcastLoggedInUser, recordError } = vi.hoisted(() => ({
    broadcastLoggedInUser: vi.fn(),
    recordError: vi.fn(),
}));

vi.mock("@client", async () => {
    const shared = await import("@shared");
    return { subscribe: shared.subscribe, inititaliseLogger: vi.fn() };
});
vi.mock("@stores/xframe", () => ({ broadcastLoggedInUser }));
vi.mock("@utils/errorPostmortem", () => ({ recordError }));

import type { Logger, OpenChat } from "@client";
import { boundaryErrorHandler, subscribeToSessionEvents } from "./appRoot.svelte";

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

describe("the root's boundary error handler", () => {
    test("records the error and logs it", () => {
        const logger = { error: vi.fn() } as unknown as Logger;
        const err = new Error("boom");
        boundaryErrorHandler(logger)(err);
        expect(recordError).toHaveBeenCalledWith("boundary", err);
        expect(logger.error).toHaveBeenCalledWith("Top level boundary error: ", err);
    });
});

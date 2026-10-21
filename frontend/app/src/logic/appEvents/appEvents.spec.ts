import { publish, type ChatListScope, type ChatSummary, type Notification } from "@client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
    chatWithRoute,
    dismissedRoute,
    subscribeAppEvents,
    type AppEventOutcome,
} from "./appEvents";

const { invoke, ring, stopRinging } = vi.hoisted(() => ({
    invoke: vi.fn(),
    ring: vi.fn(),
    stopRinging: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@src/stores/video", () => ({
    ringForRemoteCall: ring,
    stopRingingForRemoteCall: stopRinging,
}));

const favourites: ChatListScope = { kind: "favourite" };

function client(native = false) {
    return {
        getDefaultScope: (): ChatListScope => ({ kind: "chats" }),
        isNativeApp: () => native,
        notificationReceived: vi.fn(),
    };
}

function dm(userId: string): ChatSummary {
    return { kind: "direct_chat", them: { kind: "direct_chat", userId } } as ChatSummary;
}

describe("app events", () => {
    let outcomes: AppEventOutcome[];
    let unsubscribe: () => void;
    let c: ReturnType<typeof client>;

    beforeEach(() => {
        outcomes = [];
        c = client();
        unsubscribe = subscribeAppEvents(c, (o) => outcomes.push(o));
    });
    afterEach(() => {
        unsubscribe();
        vi.clearAllMocks();
    });

    /** Invariant 1: notFound, noAccess and restrictedContent each ask for their dialog (a bad link
     * or a restricted chat never just spins). */
    test("each unshowable chat asks for its dialog", () => {
        publish("notFound");
        publish("noAccess");
        publish("restrictedContent");
        publish("suspendUser", "u1");
        expect(outcomes).toEqual([
            { kind: "show", dialog: { kind: "not_found" } },
            { kind: "show", dialog: { kind: "no_access" } },
            { kind: "show", dialog: { kind: "restricted_content" } },
            { kind: "show", dialog: { kind: "suspending", userId: "u1" } },
        ]);
    });

    /** Invariant 2: closing those dialogs, or the selected chat going invalid, goes to the default scope. */
    test("an invalid selected chat goes to the default scope", () => {
        publish("selectedChatInvalid");
        expect(outcomes).toEqual([{ kind: "navigate", path: "/chats", closeDialogs: false }]);
        expect(dismissedRoute(c)).toBe("/chats");
    });

    /** Invariant 3: chatWith closes open dialogs and opens the DM. */
    test("chat with closes dialogs and opens the DM", () => {
        publish("chatWith", { kind: "direct_chat", userId: "u1" });
        expect(outcomes).toEqual([
            { kind: "navigate", path: "/chats/user/u1", closeDialogs: true },
        ]);
    });

    /** Invariant 4: a change to the user's own suspension starts the app again, natively too. */
    test("a suspension change reloads, or restarts the native app", () => {
        const reload = vi.fn();
        vi.stubGlobal("location", { ...window.location, reload });
        publish("userSuspensionChanged");
        expect(reload).toHaveBeenCalledOnce();
        expect(invoke).not.toHaveBeenCalled();

        unsubscribe();
        unsubscribe = subscribeAppEvents(client(true), () => {});
        publish("userSuspensionChanged");
        expect(invoke).toHaveBeenCalledWith("plugin:oc|restart_app");
        vi.unstubAllGlobals();
    });

    /** Invariant 5: notifications reach the client and remote calls ring and stop, in every tree. */
    test("notifications and remote calls are handled", () => {
        const n = { kind: "direct_notification" } as Notification;
        const call = {
            chatId: { kind: "direct_chat", userId: "u1" },
            userId: "u1",
            messageId: 7n,
            currentUserIsParticipant: false,
            callType: "default",
            timestamp: 0n,
        } as const;
        publish("notification", n);
        publish("remoteVideoCallStarted", call);
        publish("remoteVideoCallEnded", 7n);
        expect(c.notificationReceived).toHaveBeenCalledWith(n);
        expect(ring).toHaveBeenCalledWith(call);
        expect(stopRinging).toHaveBeenCalledWith(7n);
    });

    test("unsubscribing stops every handler", () => {
        unsubscribe();
        publish("notFound");
        publish("notification", { kind: "direct_notification" } as Notification);
        expect(outcomes).toEqual([]);
        expect(c.notificationReceived).not.toHaveBeenCalled();
        unsubscribe = () => {};
    });
});

/** Invariant 3: a DM opens in the current scope when it's listed there (matched by user, not by
 * object identity, which never matched), and under chats otherwise. */
describe("chat with route", () => {
    test("a listed DM stays in the scope", () => {
        expect(chatWithRoute({ kind: "direct_chat", userId: "u1" }, [dm("u1")], favourites)).toBe(
            "/favourite/user/u1",
        );
    });

    test("an unlisted DM opens under chats", () => {
        expect(chatWithRoute({ kind: "direct_chat", userId: "u2" }, [dm("u1")], favourites)).toBe(
            "/chats/user/u2",
        );
    });
});

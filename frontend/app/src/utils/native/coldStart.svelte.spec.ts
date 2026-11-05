import { flushSync } from "svelte";
import type { NativeCallAction } from "./call_bridge";
import { ColdStartIntents } from "./coldStart.svelte";

const call: NativeCallAction = {
    kind: "accept",
    chatId: { kind: "direct_chat", userId: "alice" },
    callType: "default",
    messageId: 77n,
};

describe("what a cold start parked", () => {
    test("is taken once", () => {
        const intents = new ColdStartIntents();
        intents.parkNotificationTap("/user/alice");
        expect(intents.pending).toBe(true);
        expect(intents.take()).toEqual({ kind: "notification", path: "/user/alice" });
        expect(intents.pending).toBe(false);
        expect(intents.take()).toBeUndefined();
    });

    test("is an answered call before a deep link before a notification tap, the others dropped", () => {
        const intents = new ColdStartIntents();
        intents.parkNotificationTap("/user/alice");
        intents.parkDeepLink("https://oc.app/group/g1");
        intents.parkCall(call);
        expect(intents.take()).toEqual({ kind: "call", action: call });
        expect(intents.take()).toBeUndefined();

        intents.parkNotificationTap("/user/alice");
        intents.parkDeepLink("https://oc.app/group/g1");
        expect(intents.take()).toEqual({ kind: "deep_link", url: "https://oc.app/group/g1" });
        expect(intents.pending).toBe(false);
    });

    test("is seen by an effect that looked before it landed, and opened once", () => {
        const intents = new ColdStartIntents();
        const opened: string[] = [];
        const cleanup = $effect.root(() => {
            $effect(() => {
                const intent = intents.take();
                if (intent?.kind === "notification") opened.push(intent.path);
            });
        });
        flushSync();
        expect(opened).toEqual([]);
        // the listener pulls it from the shell after the router first looked
        intents.parkNotificationTap("/user/alice");
        flushSync();
        expect(opened).toEqual(["/user/alice"]);
        flushSync();
        expect(opened).toEqual(["/user/alice"]);
        cleanup();
    });
});

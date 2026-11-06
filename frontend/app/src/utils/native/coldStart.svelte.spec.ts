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

    test("is seen by an effect that reads `pending` and looked before it landed, and opened once", () => {
        // src/native's router: opens what lands, whenever it lands, with no default of its own
        const intents = new ColdStartIntents();
        const opened: string[] = [];
        let runs = 0;
        const cleanup = $effect.root(() => {
            $effect(() => {
                runs++;
                if (!intents.pending) return;
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
        const runsAfterOpening = runs;
        flushSync();
        expect(opened).toEqual(["/user/alice"]);
        expect(runs).toBe(runsAfterOpening);
        cleanup();
    });

    test("taken in an effect, doesn't run that effect again to fall through to its default", () => {
        // components_mobile's router: the intent, else the default chat, each time its list shows
        const intents = new ColdStartIntents();
        const done: string[] = [];
        const listShows = $state({ value: false });
        intents.parkCall(call);
        const cleanup = $effect.root(() => {
            $effect(() => {
                if (!listShows.value) return;
                const intent = intents.take();
                done.push(intent?.kind ?? "default chat");
            });
        });
        flushSync();
        listShows.value = true;
        flushSync();
        flushSync();
        // the call alone: no default chat opened under it
        expect(done).toEqual(["call"]);
        // nor does one parked later run it (it takes one only when its list shows)
        intents.parkNotificationTap("/user/alice");
        flushSync();
        expect(done).toEqual(["call"]);
        cleanup();
    });
});

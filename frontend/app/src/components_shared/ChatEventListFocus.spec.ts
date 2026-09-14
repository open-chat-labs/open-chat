import { flushSync, mount, tick, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The client package reads the screen width through matchMedia at import time;
// jsdom does not provide it, so stub it before the component (and so the
// client) is imported
vi.hoisted(() => {
    window.matchMedia = ((query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            onchange: null,
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

import type { ChatSummary, EventWrapper, Message, MessageContext, OpenChat } from "@client";
import { publish } from "@client";
import Harness from "./ChatEventListFocus.spec.harness.svelte";
import type { FlatChatItem } from "./flatChatItems";

// Invariants from #9358 (chat selection focused message jitter):
//   2. when the announced target is present in the list's items, the list
//      positions on it in the same flush that renders those items, without
//      waiting for loadedMessageWindow
//   3. while an announced target is outstanding and not yet positioned, the
//      viewport is hidden
//   4. a window load that ends without positioning its target reveals the
//      viewport
//   5. a target announced for a different context is dropped when the list's
//      context changes; one announced for the incoming context survives the
//      switch and is honoured
//   6. an items change landing while the navigation is in flight re-centres
//      the target; it does not pin a row to where it sat before the
//      navigation's refine

function chatSummary(groupId: string): ChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId },
        latestEventIndex: 0,
        latestMessage: undefined,
        membership: {},
    } as unknown as ChatSummary;
}

function context(chat: ChatSummary): MessageContext {
    return { chatId: chat.id, threadRootMessageIndex: undefined };
}

// newest first, like the timeline
function messageItems(indexes: number[]): FlatChatItem[] {
    return [...indexes]
        .sort((a, b) => b - a)
        .map((messageIndex) => {
            const event: EventWrapper<Message> = {
                index: messageIndex + 1,
                timestamp: BigInt(1_700_000_000_000 + messageIndex),
                expiresAt: undefined,
                event: {
                    kind: "message",
                    messageId: BigInt(1000 + messageIndex),
                    messageIndex,
                    sender: "user1",
                    content: { kind: "text_content", text: `message ${messageIndex}` },
                    reactions: [],
                    tips: {},
                    edited: false,
                    forwarded: false,
                    deleted: false,
                    blockLevelMarkdown: false,
                },
            } as unknown as EventWrapper<Message>;
            return {
                kind: "event",
                key: `${event.index}_${event.event.messageId}`,
                event,
                first: true,
                last: true,
            };
        });
}

function fakeClient(): OpenChat {
    const known: Record<string, unknown> = {
        moreNewMessagesAvailable: () => false,
        morePreviousMessagesAvailable: () => false,
        isMessageRead: () => true,
        markMessagesRead: vi.fn(),
        loadEventWindow: vi.fn(async () => undefined),
        loadPreviousMessages: vi.fn(async () => undefined),
        loadNewMessages: vi.fn(async () => undefined),
    };
    return new Proxy(known, {
        get: (target, prop) =>
            typeof prop === "symbol"
                ? undefined
                : prop in target
                  ? target[prop]
                  : () => Promise.resolve(undefined),
    }) as unknown as OpenChat;
}

class FakeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

function render(chat: ChatSummary, items: FlatChatItem[] = []) {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const app = mount(Harness, {
        target,
        props: { chat, items, visible: true },
        context: new Map<string, unknown>([["client", fakeClient()]]),
    });
    flushSync();
    const viewport = () => target.querySelector(".vcl-viewport") as HTMLElement;
    return {
        app,
        viewport,
        hidden: () => viewport().classList.contains("vcl-unpositioned"),
        focused: () =>
            (target.querySelector(".msg[data-focused]") as HTMLElement | null)?.dataset.index,
        setItems(next: FlatChatItem[]) {
            app.setItems(next);
            flushSync();
        },
        setChat(next: ChatSummary) {
            app.setChat(next);
            flushSync();
        },
        destroy: () => unmount(app),
    };
}

describe("chat event list positions on the announced window target (#9358)", () => {
    let scrollTo: ReturnType<typeof vi.fn>;
    let harness: ReturnType<typeof render> | undefined;

    beforeEach(() => {
        vi.stubGlobal("IntersectionObserver", FakeObserver);
        vi.stubGlobal("ResizeObserver", FakeObserver);
        // jsdom has no CSS.escape (the list looks rows up by key with it)
        vi.stubGlobal("CSS", { escape: (s: string) => s });
        scrollTo = vi.fn(function (this: Element, opts?: ScrollToOptions | number) {
            if (typeof opts === "object" && opts.top !== undefined) this.scrollTop = opts.top;
        });
        Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
    });

    afterEach(() => {
        harness?.destroy();
        harness = undefined;
        document.body.innerHTML = "";
        vi.unstubAllGlobals();
    });

    // invariant 2
    test("positions on the target in the flush that renders it, before loadedMessageWindow", () => {
        const chat = chatSummary("g1");
        harness = render(chat);
        publish("loadingMessageWindow", { context: context(chat), messageIndex: 3 });
        flushSync();
        expect(scrollTo).not.toHaveBeenCalled();

        harness.setItems(messageItems([0, 1, 2, 3, 4, 5, 6]));

        // no loadedMessageWindow has been published, yet the list has scrolled
        // to the target and highlighted it
        expect(scrollTo).toHaveBeenCalled();
        expect(harness.focused()).toBe("3");
        expect(harness.app.isInitialised()).toBe(true);
    });

    // invariant 3
    test("hides the viewport while the announced target is outstanding", () => {
        const chat = chatSummary("g1");
        harness = render(chat);
        expect(harness.hidden()).toBe(false);

        publish("loadingMessageWindow", { context: context(chat), messageIndex: 3 });
        flushSync();
        expect(harness.hidden()).toBe(true);

        // a partial chunk without the target keeps it hidden
        harness.setItems(messageItems([10, 11, 12]));
        expect(harness.hidden()).toBe(true);

        harness.setItems(messageItems([0, 1, 2, 3, 4, 5, 6]));
        expect(harness.hidden()).toBe(false);
    });

    // invariant 4
    test("reveals the viewport when the load ends without its target", () => {
        const chat = chatSummary("g1");
        harness = render(chat);
        publish("loadingMessageWindow", { context: context(chat), messageIndex: 3 });
        harness.setItems(messageItems([10, 11, 12]));
        expect(harness.hidden()).toBe(true);

        publish("loadedMessageWindow", {
            context: context(chat),
            messageIndex: undefined,
            initialLoad: true,
        });
        flushSync();
        expect(harness.hidden()).toBe(false);
    });

    // invariant 4 (fallback to the latest messages)
    test("reveals the viewport when the load falls back to previous messages", () => {
        const chat = chatSummary("g1");
        harness = render(chat);
        publish("loadingMessageWindow", { context: context(chat), messageIndex: 3 });
        harness.setItems(messageItems([10, 11, 12]));
        expect(harness.hidden()).toBe(true);

        publish("loadedPreviousMessages", { context: context(chat), initialLoad: true });
        flushSync();
        expect(harness.hidden()).toBe(false);
    });

    // invariant 4 (target loaded but filtered out of the timeline)
    test("reveals the viewport when the target never appears in the items", () => {
        const chat = chatSummary("g1");
        harness = render(chat);
        publish("loadingMessageWindow", { context: context(chat), messageIndex: 3 });
        harness.setItems(messageItems([10, 11, 12]));
        expect(harness.hidden()).toBe(true);

        publish("loadedMessageWindow", {
            context: context(chat),
            messageIndex: 3,
            initialLoad: true,
        });
        flushSync();
        expect(harness.hidden()).toBe(false);
    });

    // invariant 5
    test("a target announced for the incoming chat survives the context switch", () => {
        const a = chatSummary("a");
        const b = chatSummary("b");
        harness = render(a, messageItems([0, 1, 2]));
        // the announcement lands before the list has switched to chat b
        publish("loadingMessageWindow", { context: context(b), messageIndex: 3 });
        flushSync();
        // not our context yet: the visible chat is untouched
        expect(harness.hidden()).toBe(false);
        expect(harness.focused()).toBeUndefined();

        harness.setChat(b);
        harness.setItems([]);
        expect(harness.hidden()).toBe(true);
        scrollTo.mockClear();

        harness.setItems(messageItems([0, 1, 2, 3, 4, 5]));
        expect(scrollTo).toHaveBeenCalled();
        expect(harness.focused()).toBe("3");
        expect(harness.hidden()).toBe(false);
    });

    // invariant 6
    test("an items change during the navigation re-centres the target instead of undoing it", async () => {
        // Fake geometry: rows are 100px tall, stacked in DOM order from the
        // viewport's top, and move against scrollTop the way real content
        // does; the viewport is 1000px tall at the top of the page
        const ROW = 100;
        const VP = 1000;
        Element.prototype.getBoundingClientRect = function (this: Element) {
            const rect = { left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) };
            if (this.classList.contains("vcl-viewport")) {
                return { ...rect, top: 0, bottom: VP, height: VP } as DOMRect;
            }
            const row = this.closest(".vcl-row");
            const vp = this.closest(".vcl-viewport");
            if (row === null || vp === null) {
                return { ...rect, top: 0, bottom: 0, height: 0 } as DOMRect;
            }
            const rows = [...vp.querySelectorAll(".vcl-row")];
            const top = rows.indexOf(row) * ROW - vp.scrollTop;
            return { ...rect, top, bottom: top + ROW, height: ROW } as DOMRect;
        };
        const centred = (index: number) => {
            const vp = harness!.viewport();
            const row = vp.querySelector(`.msg[data-index="${index}"]`)!.closest(".vcl-row")!;
            const r = row.getBoundingClientRect();
            return Math.abs(r.top + r.height / 2 - VP / 2) <= 4;
        };

        const chat = chatSummary("g1");
        harness = render(chat);
        publish("loadingMessageWindow", { context: context(chat), messageIndex: 3 });
        const items = messageItems([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        harness.setItems(items);
        // the arrival positioning has scrolled on estimates; its refine
        // against the rects is queued. Before it runs another item lands (the
        // chat_start row the list appends once it is initialised), queueing
        // the items pass re-anchor behind it
        harness.setItems([...items, { kind: "chat_start", key: "chat_start_g1" }]);
        await tick();
        await tick();
        expect(centred(3)).toBe(true);
    });

    // invariant 5
    test("a target announced for another chat is dropped when the context changes", () => {
        const a = chatSummary("a");
        const b = chatSummary("b");
        const c = chatSummary("c");
        harness = render(a, messageItems([0, 1, 2]));
        publish("loadingMessageWindow", { context: context(c), messageIndex: 1 });
        flushSync();

        harness.setChat(b);
        harness.setItems(messageItems([0, 1, 2]));
        expect(harness.hidden()).toBe(false);
        expect(harness.focused()).toBeUndefined();
    });
});

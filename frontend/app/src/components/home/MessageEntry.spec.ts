import { flushSync, mount, tick, unmount } from "svelte";
import { addMessages, init } from "svelte-i18n";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

// The client package and component-lib read the screen width through matchMedia at import time;
// jsdom has none. Hoisted so it runs before the imports below.
vi.hoisted(() => {
    window.matchMedia = ((query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

import type { ChatSummary, MessageContext, OpenChat } from "@client";
import { currentUserStore } from "@client";
import { loadRichTextEditor } from "@shared_components/richTextEditorLoader";
import MobileMessageEntry from "../../components_mobile/home/MessageEntry.svelte";
import en from "../../i18n/en.json";
import Harness from "./MessageEntry.spec.harness.svelte";
import DesktopMessageEntry from "./MessageEntry.svelte";

type Component = typeof DesktopMessageEntry | typeof MobileMessageEntry;

const chat = {
    kind: "direct_chat",
    id: { kind: "direct_chat", userId: "them" },
    them: { kind: "direct_chat", userId: "them" },
    membership: {},
} as unknown as ChatSummary;
const messageContext: MessageContext = { chatId: chat.id };

function fakeClient(): OpenChat {
    const known: Record<string, unknown> = {
        canSendMessage: () => true,
        permittedMessages: () => new Map([["text", true]]),
        directChatWithBot: () => undefined,
        isChatOrCommunityFrozen: () => false,
        audioRecordingMimeType: () => undefined,
        extractEnabledLinks: () => [],
        stripLinkDisabledMarker: (text: string) => text,
    };
    return new Proxy(known, {
        get: (target, prop) =>
            typeof prop === "symbol" ? undefined : prop in target ? target[prop] : () => undefined,
    }) as unknown as OpenChat;
}

async function render(Entry: Component, textContent: string | undefined) {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const app = mount(Harness, {
        target,
        props: {
            Entry,
            textContent,
            props: {
                chat,
                preview: false,
                lapsed: false,
                joining: undefined,
                attachment: undefined,
                editingEvent: undefined,
                replyingTo: undefined,
                externalContent: false,
                messageContext,
                user: { kind: "created_user", userId: "me", username: "me" },
                inputTrayVisible: false,
                onStartTyping: () => {},
                onStopTyping: () => {},
            },
        },
        context: new Map<string, unknown>([["client", fakeClient()]]),
    });
    flushSync();
    await tick();
    return {
        text: () => (target.querySelector(".ProseMirror") as HTMLElement | null)?.textContent,
        setBlocked(value: boolean) {
            app.setBlocked(value);
            flushSync();
        },
        destroy: () => {
            unmount(app);
            target.remove();
        },
    };
}

class FakeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

beforeAll(async () => {
    // bind:clientHeight watches the entry's size
    globalThis.ResizeObserver ??= FakeObserver as unknown as typeof ResizeObserver;

    // ProseMirror measures the selection when the editor is focused; jsdom does no layout
    const rect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
    Range.prototype.getBoundingClientRect = () => rect as DOMRect;
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    Element.prototype.scrollIntoView = () => {};
    document.elementFromPoint = () => null;

    // Anonymous users can't send messages, so the entry would show no editor
    currentUserStore.set({ ...currentUserStore.value, userId: "me", username: "me" });

    addMessages("en", en);
    await init({ fallbackLocale: "en", initialLocale: "en" });

    // Both entries render the editor straight away once its chunk has loaded
    await loadRichTextEditor();
});

// Desktop and mobile carry their own copy of the component, so every invariant is pinned on both.
describe.each<[string, Component]>([
    ["desktop", DesktopMessageEntry],
    ["mobile", MobileMessageEntry],
])("MessageEntry (%s)", (_, Entry) => {
    let destroy: (() => void) | undefined;
    afterEach(() => destroy?.());

    test("shows the draft when mounted", async () => {
        const r = await render(Entry, "my draft");
        destroy = r.destroy;
        expect(r.text()).toBe("my draft");
    });

    // Invariant: the entry outlives its editor (it stays mounted across chat switches while the
    // editor is hidden in read-only, previewed, blocked or frozen chats), and an editor shown
    // again holds the current draft
    test("puts the draft back into an editor that is shown again", async () => {
        const r = await render(Entry, "my draft");
        destroy = r.destroy;

        r.setBlocked(true);
        expect(r.text()).toBeUndefined();

        r.setBlocked(false);
        expect(r.text()).toBe("my draft");
    });
});

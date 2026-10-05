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

import type { ChatSummary, EventWrapper, Message, MessageContext, OpenChat } from "@client";
import { botState, currentUserStore } from "@client";
import type { Editor } from "@tiptap/core";
import { loadRichTextEditor } from "@shared_components/richTextEditorLoader";
import { enterSend } from "@stores/settings";
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
    const onStartTyping = vi.fn();
    const onSendMessage = vi.fn();
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
                replyingTo: undefined,
                externalContent: false,
                messageContext,
                user: { kind: "created_user", userId: "me", username: "me" },
                inputTrayVisible: false,
                onStartTyping,
                onSendMessage,
                onStopTyping: () => {},
            },
        },
        context: new Map<string, unknown>([["client", fakeClient()]]),
    });
    flushSync();
    await tick();
    const editorEl = () => target.querySelector(".ProseMirror") as HTMLElement | null;
    return {
        text: () => editorEl()?.textContent,
        draft: () => app.getTextContent(),
        onStartTyping,
        onSendMessage,
        setBlocked(value: boolean) {
            app.setBlocked(value);
            flushSync();
        },
        // Hands the entry another chat's draft, as switching chats does
        switchDraft(value: string | undefined) {
            app.setTextContent(value);
            flushSync();
        },
        edit(text: string) {
            app.setEditingEvent({
                event: { kind: "message", content: { kind: "text_content", text } },
                index: 1,
                timestamp: 0n,
            } as unknown as EventWrapper<Message>);
            flushSync();
        },
        // Types into the editor as the user would. TipTap hangs the editor off its element.
        type(text: string) {
            (editorEl() as unknown as { editor: Editor }).editor.commands.insertContent(text);
            flushSync();
        },
        pressEnter() {
            editorEl()?.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
            );
            flushSync();
        },
        destroy: () => {
            unmount(app);
            target.remove();
        },
    };
}

// The entry reports typing on the next animation frame
function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
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
    afterEach(() => {
        destroy?.();
        vi.restoreAllMocks();
    });

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

    // Invariant: only the user's own input counts as typing, so putting a draft into the editor
    // (when the entry is mounted or the user switches chats) doesn't tell the chat's members that
    // the user is typing
    test("doesn't count restoring a draft as the user typing", async () => {
        const r = await render(Entry, "my draft");
        destroy = r.destroy;
        await nextFrame();
        expect(r.onStartTyping).not.toHaveBeenCalled();

        r.switchDraft("another draft");
        expect(r.text()).toBe("another draft");
        await nextFrame();
        expect(r.onStartTyping).not.toHaveBeenCalled();

        r.type("!");
        await nextFrame();
        expect(r.onStartTyping).toHaveBeenCalledOnce();
    });

    // Neither the Enter that sends the message nor clearing the editor afterwards is typing
    test("doesn't count sending a message as the user typing", async () => {
        // jsdom passes for a touch device, which doesn't send on Enter by default
        const sendsOnEnter = enterSend.value;
        enterSend.set(true);
        try {
            const r = await render(Entry, undefined);
            destroy = r.destroy;
            r.type("hi");
            await nextFrame();
            expect(r.onStartTyping).toHaveBeenCalledOnce();

            // Long enough after the last typing notification for the entry to send another
            vi.spyOn(Date, "now").mockReturnValue(Date.now() + 2000);
            r.pressEnter();
            expect(r.onSendMessage).toHaveBeenCalledOnce();
            await nextFrame();
            expect(r.onStartTyping).toHaveBeenCalledOnce();
        } finally {
            enterSend.set(sendsOnEnter);
        }
    });

    test("doesn't open the command selector for a restored draft", async () => {
        const setPrefix = vi.spyOn(botState, "prefix", "set");
        const r = await render(Entry, "/command");
        destroy = r.destroy;
        expect(r.text()).toBe("/command");
        expect(setPrefix).not.toHaveBeenCalled();

        r.switchDraft(undefined);
        r.switchDraft("/another");
        expect(r.text()).toBe("/another");
        expect(setPrefix).not.toHaveBeenCalled();

        r.type(" more");
        expect(setPrefix).toHaveBeenCalledWith("/another more");
    });

    // Invariant: the draft holds the message being edited, as sending reads it from there
    test("puts the message being edited into the draft", async () => {
        const r = await render(Entry, undefined);
        destroy = r.destroy;

        r.edit("the original");
        expect(r.text()).toBe("the original");
        expect(r.draft()).toBe("the original");
        await nextFrame();
        expect(r.onStartTyping).not.toHaveBeenCalled();
    });
});

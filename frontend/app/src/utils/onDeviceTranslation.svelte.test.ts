import type { ChatEvent, ChatIdentifier, EventWrapper, MessageContent } from "@client";
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
    autoTranslatableText,
    OnDeviceChatTranslator,
    protect,
    restore,
    setAutoTranslate,
    textsToPreload,
    toBcp47,
} from "./onDeviceTranslation.svelte";

type Availability = "unavailable" | "downloadable" | "downloading" | "available";

// Stands in for Chrome's built-in Translator and LanguageDetector APIs. Every text is French unless
// listed in `languages`, and every language pack is on disk unless listed in `availability`.
class FakeBrowser {
    languages = new Map<string, { lang: string; confidence?: number }>();
    availability = new Map<string, Availability>();
    activation = { isActive: false };
    rejectCreate: string | undefined;
    createGate: Promise<void> | undefined;
    translateGate: Promise<void> | undefined;
    translated: { source: string; target: string; text: string }[] = [];
    created: string[] = [];
    // Texts whose translation always fails
    failing = new Set<string>();
    attempts: string[] = [];
    #live = new Set<{ dead: boolean }>();
    destroyed: string[] = [];

    install() {
        const g = globalThis as Record<string, unknown>;
        g.LanguageDetector = {
            availability: async () => "available",
            create: async () => ({
                detect: async (text: string) => {
                    const l = this.languages.get(text) ?? { lang: "fr" };
                    return [{ detectedLanguage: l.lang, confidence: l.confidence ?? 0.9 }];
                },
                destroy() {},
            }),
        };
        g.Translator = {
            availability: async ({ sourceLanguage }: { sourceLanguage: string }) =>
                this.availability.get(sourceLanguage) ?? "available",
            create: async ({
                sourceLanguage,
                targetLanguage,
            }: {
                sourceLanguage: string;
                targetLanguage: string;
            }) => {
                this.created.push(sourceLanguage);
                await this.createGate;
                if (this.rejectCreate !== undefined) {
                    throw new DOMException("create failed", this.rejectCreate);
                }
                const availability = this.availability.get(sourceLanguage) ?? "available";
                if (availability !== "available" && !this.activation.isActive) {
                    throw new DOMException("needs a user gesture", "NotAllowedError");
                }
                this.availability.delete(sourceLanguage);
                const instance = { dead: false };
                this.#live.add(instance);
                return {
                    translate: async (text: string) => {
                        await this.translateGate;
                        this.attempts.push(text);
                        if (instance.dead || this.failing.has(text)) {
                            throw new DOMException(
                                "Other generic failures occurred.",
                                "UnknownError",
                            );
                        }
                        this.translated.push({
                            source: sourceLanguage,
                            target: targetLanguage,
                            text,
                        });
                        return `${targetLanguage}:${text}`;
                    },
                    destroy: () => this.destroyed.push(sourceLanguage),
                };
            },
        };
        Object.defineProperty(navigator, "userActivation", {
            value: this.activation,
            configurable: true,
        });
    }

    // What installing another language pack does to translators Chrome has already handed out
    killTranslators() {
        for (const instance of this.#live) instance.dead = true;
        this.#live.clear();
    }

    uninstall() {
        const g = globalThis as Record<string, unknown>;
        delete g.LanguageDetector;
        delete g.Translator;
    }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    return { promise, resolve };
}

// Runs the idle-callback kick, the detector and translator promises and the batched flush
async function settle() {
    for (let i = 0; i < 5; i++) {
        await vi.runAllTimersAsync();
    }
}

// Three messages, in French, German and Spanish, whose language packs all need downloading
function enqueueThreeLanguages() {
    ["fr", "de", "es"].forEach((lang, i) => {
        browser.availability.set(lang, "downloadable");
        const text = lang === "fr" ? FRENCH : `${lang} message text`;
        browser.languages.set(text, { lang });
        translator.enqueue(BigInt(i), i, text);
    });
}

const chatId: ChatIdentifier = { kind: "group_chat", groupId: "abcde" };
const FRENCH = "bonjour tout le monde";

let browser: FakeBrowser;
let translator: OnDeviceChatTranslator;

beforeEach(() => {
    vi.useFakeTimers();
    browser = new FakeBrowser();
    browser.install();
    translator = new OnDeviceChatTranslator();
});

afterEach(() => {
    browser.uninstall();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
});

describe("protect and restore", () => {
    test("maps our locale codes to BCP 47", () => {
        expect(toBcp47("cn")).toEqual("zh");
        expect(toBcp47("iw")).toEqual("he");
        expect(toBcp47("jp")).toEqual("ja");
        expect(toBcp47("fr")).toEqual("fr");
        expect(toBcp47("en-GB")).toEqual("en");
        expect(toBcp47(undefined)).toEqual("en");
    });

    // Invariant: every token the renderer reads out of message text reaches it byte for byte
    test("protects mentions, urls and code from the translator", () => {
        const tokens = [
            "@UserId(abc-123)",
            "@UserGroup(42)",
            "@everyone",
            "@DateTime(1790872427682)",
            "https://oc.app/faq",
            "`npm run dev`",
            "```\nconst a = 1;\n```",
        ];
        const original = `Salut ${tokens[0]} ${tokens[1]} ${tokens[2]}, le ${tokens[3]}, regarde ${tokens[4]} et lance ${tokens[5]} ${tokens[6]}`;
        const p = protect(original)!;
        expect(p.text).toEqual("Salut [0] [1] [2], le [3], regarde [4] et lance [5] [6]");
        expect(p.tokens).toEqual(tokens);
        expect(restore("Hi [0] [1] [2], on [3], look at [4] and run [5] [6]", p)).toEqual(
            `Hi ${tokens[0]} ${tokens[1]} ${tokens[2]}, on ${tokens[3]}, look at ${tokens[4]} and run ${tokens[5]} ${tokens[6]}`,
        );
    });

    test("leaves words that only start like a token alone", () => {
        expect(protect("Salut @everyones")!.tokens).toEqual([]);
    });

    test("gives up rather than showing a mangled placeholder", () => {
        const p = protect("Salut @UserId(abc)")!;
        expect(restore("Hi (0)", p)).toBeUndefined();
    });

    test("restore leaves tokens containing replacement patterns intact", () => {
        const p = protect("voir https://x.com/$&")!;
        expect(restore("see [0]", p)).toEqual("see https://x.com/$&");
    });

    test("avoids placeholders that collide with literal text", () => {
        const p = protect("[1] Salut @UserId(a) voir https://oc.app")!;
        expect(p.text).toEqual("[1] Salut {0} voir {1}");
        expect(restore("[1] Hi {0} see {1}", p)).toEqual("[1] Hi @UserId(a) see https://oc.app");
    });
});

describe("OnDeviceChatTranslator", () => {
    // Invariant: every queued foreign message gets translated, including messages released by a
    // language pack that became ready just as the queue finished draining
    test("translates a foreign message into the target language", async () => {
        translator.enqueue(1n, 1, FRENCH);
        await settle();
        expect(translator.translationFor(1n, FRENCH)).toEqual({
            source: FRENCH,
            text: `en:${FRENCH}`,
            from: "fr",
        });
    });

    // Invariant: message text never leaves the device on this path
    test("makes no network request", async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
        const xhrSpy = vi.spyOn(XMLHttpRequest.prototype, "open");
        translator.enqueue(1n, 1, `${FRENCH} https://oc.app`);
        await translator.preload([FRENCH]);
        await settle();
        expect(browser.translated).toHaveLength(1);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(xhrSpy).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    // Invariant: without the browser APIs, nothing runs and nothing fails
    test("does nothing in a browser without the APIs", async () => {
        browser.uninstall();
        const warn = vi.spyOn(console, "warn");
        const rejections: unknown[] = [];
        const onRejection = (reason: unknown) => rejections.push(reason);
        process.on("unhandledRejection", onRejection);
        try {
            translator.enqueue(1n, 1, FRENCH);
            translator.prime();
            await translator.preload([FRENCH]);
            await settle();
            // Node reports unhandled rejections once a macrotask has passed
            vi.useRealTimers();
            await new Promise((r) => setTimeout(r, 0));
        } finally {
            process.off("unhandledRejection", onRejection);
        }
        expect(rejections).toEqual([]);
        expect(warn).not.toHaveBeenCalled();
        expect(translator.error).toBeUndefined();
        expect(translator.translations.size).toEqual(0);
    });

    // Invariant: messages already in the target language, too short to detect, detected with low
    // confidence or longer than the limit never reach a translator
    test("skips messages it shouldn't translate", async () => {
        browser.languages.set("hello there everyone", { lang: "en" });
        browser.languages.set("hmm peut-être bien", { lang: "fr", confidence: 0.3 });
        browser.languages.set("zzzz zzzz zzzz", { lang: "und" });
        const texts = [
            "hello there everyone",
            "ok",
            "hmm peut-être bien",
            "zzzz zzzz zzzz",
            "a".repeat(2001),
        ];
        texts.forEach((text, i) => translator.enqueue(BigInt(i), i, text));
        await settle();
        expect(browser.translated).toEqual([]);
        expect(translator.translations.size).toEqual(0);
    });

    // Invariant: an edited message is translated again, and a translation of the old text is never
    // returned for the new text
    test("never returns a translation of a message's previous text", async () => {
        browser.languages.set("hello my friends", { lang: "en" });
        translator.enqueue(1n, 1, FRENCH);
        await settle();
        expect(translator.translationFor(1n, FRENCH)).toBeDefined();

        translator.enqueue(1n, 1, "hello my friends");
        await settle();
        expect(translator.translationFor(1n, "hello my friends")).toBeUndefined();

        translator.enqueue(1n, 1, "salut les amis");
        await settle();
        expect(translator.translationFor(1n, "salut les amis")?.text).toEqual("en:salut les amis");
    });

    // Invariant: changing locale discards everything produced for the old target language
    test("a locale change discards translations and translators for the old language", async () => {
        browser.availability.set("es", "downloadable");
        browser.languages.set("hola a todos amigos", { lang: "es" });
        translator.enqueue(1n, 1, FRENCH);
        translator.enqueue(2n, 2, "hola a todos amigos");
        await settle();
        expect(translator.translations.size).toEqual(1);
        expect(translator.waiting.get(2n)).toEqual("es");
        expect(translator.needsDownload.has("es")).toBe(true);

        translator.setTarget("de");
        expect(translator.translations.size).toEqual(0);
        expect(translator.waiting.size).toEqual(0);
        expect(translator.needsDownload.size).toEqual(0);
        expect(browser.destroyed).toEqual(["fr"]);

        translator.enqueue(1n, 1, FRENCH);
        await settle();
        expect(translator.translationFor(1n, FRENCH)?.text).toEqual(`de:${FRENCH}`);
    });

    // Invariant: a result produced for a target the user has since left is never shown
    test("drops a translation that finishes after the locale changed", async () => {
        const gate = deferred();
        browser.translateGate = gate.promise;
        translator.enqueue(1n, 1, FRENCH);
        await settle();
        translator.setTarget("de");
        gate.resolve();
        await settle();
        expect(translator.translations.size).toEqual(0);
    });

    // Invariant: a translator created for a target the user has since left is destroyed, not used
    test("destroys a translator that finishes creating after the locale changed", async () => {
        const gate = deferred();
        browser.createGate = gate.promise;
        translator.enqueue(1n, 1, FRENCH);
        await settle();
        translator.setTarget("de");
        gate.resolve();
        await settle();
        expect(browser.destroyed).toEqual(["fr"]);
        expect(browser.translated).toEqual([]);
    });

    // Invariant: a language pack download starts only from a user gesture; without one the message
    // waits and the language is offered for download, and prime() starts it and releases the message
    test("waits for a gesture before downloading a language pack", async () => {
        browser.availability.set("fr", "downloadable");
        translator.enqueue(1n, 1, FRENCH);
        await settle();
        expect(translator.needsDownload.has("fr")).toBe(true);
        expect(translator.waiting.get(1n)).toEqual("fr");
        expect(browser.created).toEqual([]);

        browser.activation.isActive = true;
        translator.prime();
        await settle();
        expect(translator.translationFor(1n, FRENCH)).toBeDefined();
        expect(translator.waiting.size).toEqual(0);
        expect(translator.needsDownload.size).toEqual(0);
    });

    // Invariant: if the gesture expires before the download starts, the language is offered again
    test("offers the download again when the gesture expired", async () => {
        browser.availability.set("fr", "downloadable");
        translator.enqueue(1n, 1, FRENCH);
        await settle();
        browser.activation.isActive = true;
        browser.rejectCreate = "NotAllowedError";
        translator.prime();
        await settle();
        expect(translator.needsDownload.has("fr")).toBe(true);
        expect(translator.waiting.get(1n)).toEqual("fr");
    });

    // Invariant: one click starts at most one language pack download, because Chrome lets a user
    // gesture start only one; the others stay offered rather than failing
    test("one click downloads one language pack", async () => {
        enqueueThreeLanguages();
        await settle();
        expect(translator.needsDownload.size).toEqual(3);

        browser.activation.isActive = true;
        translator.prime();
        await settle();
        expect(browser.created).toHaveLength(1);
        expect(translator.needsDownload.size).toEqual(2);
    });

    // Invariant: a message's own "Translate from X" link downloads X, not some other language
    test("priming a language downloads that language", async () => {
        enqueueThreeLanguages();
        await settle();
        browser.activation.isActive = true;
        translator.prime("de");
        await settle();
        expect(browser.created).toEqual(["de"]);
    });

    // Invariant: turning a chat on uses that click to start the first missing pack and offers the
    // rest, instead of trying them all and having all but one fail
    test("turning a chat on downloads one pack and offers the rest", async () => {
        for (const lang of ["de", "es"]) {
            browser.availability.set(lang, "downloadable");
            browser.languages.set(`${lang} message text`, { lang });
        }
        browser.availability.set("fr", "downloadable");
        browser.activation.isActive = true;
        await translator.preload([FRENCH, "de message text", "es message text"]);
        await settle();
        expect(browser.created).toEqual(["fr"]);
        expect([...translator.needsDownload].sort()).toEqual(["de", "es"]);
    });

    // Invariant: a translator that stops working is replaced, so its language keeps translating
    // without a reload, and no message waiting on it is dropped
    test("replaces a translator that stops working", async () => {
        translator.enqueue(1n, 1, FRENCH);
        await settle();
        expect(translator.translationFor(1n, FRENCH)).toBeDefined();

        browser.killTranslators();
        translator.enqueue(2n, 2, "salut les amis");
        translator.enqueue(3n, 3, "merci beaucoup mes amis");
        await settle();
        expect(translator.translationFor(2n, "salut les amis")).toBeDefined();
        expect(translator.translationFor(3n, "merci beaucoup mes amis")).toBeDefined();
        expect(browser.created).toEqual(["fr", "fr"]);
    });

    // Invariant: a message held over by a translate, a failure or a replaced translator is dropped
    // when the target changes meanwhile, so it's never "translated" into the language it's in
    test("drops held-over messages when the locale changes", async () => {
        for (const text of ["guten morgen zusammen", "wie geht es euch allen"]) {
            browser.languages.set(text, { lang: "de" });
        }
        const gate = deferred();
        browser.translateGate = gate.promise;
        translator.enqueue(1n, 1, "guten morgen zusammen");
        translator.enqueue(2n, 2, "wie geht es euch allen");
        await settle();
        translator.setTarget("de");
        gate.resolve();
        await settle();
        expect(translator.translations.size).toEqual(0);
        expect(browser.created).toEqual(["de"]);
    });

    // Invariant: a message whose translation keeps failing is retried once, then left alone
    test("gives up on a message that keeps failing", async () => {
        browser.failing.add(FRENCH);
        translator.enqueue(1n, 1, FRENCH);
        await settle();
        expect(translator.translations.size).toEqual(0);
        expect(browser.attempts).toEqual([FRENCH, FRENCH]);

        translator.enqueue(1n, 1, FRENCH);
        await settle();
        expect(browser.attempts).toHaveLength(2);
    });

    // Invariant: a cancelled message is forgotten, so it's never translated after it unmounts
    test("cancel removes a waiting message", async () => {
        browser.availability.set("fr", "downloadable");
        translator.enqueue(1n, 1, FRENCH);
        await settle();
        translator.cancel(1n);
        expect(translator.waiting.size).toEqual(0);

        browser.activation.isActive = true;
        translator.prime();
        await settle();
        expect(browser.translated).toEqual([]);
    });

    // Invariant: a message's enqueue effect doesn't depend on translator state, so translating
    // one message doesn't re-run (cancel and re-enqueue) the effect of every other rendered message
    test("translating one message does not re-run another message's enqueue effect", () => {
        let runs = 0;
        const cleanup = $effect.root(() => {
            $effect(() => {
                runs++;
                translator.enqueue(1n, 1, FRENCH);
                return () => translator.cancel(1n);
            });
        });
        try {
            flushSync();
            translator.translations.set(2n, { source: "hola", text: "hello", from: "es" });
            translator.waiting.set(3n, "de");
            flushSync();
            expect(runs).toEqual(1);
        } finally {
            cleanup();
        }
    });
});

describe("per-chat toggle", () => {
    // Invariant: the toggle is remembered per chat across reloads
    test("survives a reload", async () => {
        setAutoTranslate(chatId, true);
        vi.resetModules();
        const reloaded = await import("./onDeviceTranslation.svelte");
        expect(reloaded.autoTranslateEnabled(chatId)).toBe(true);
        expect(reloaded.autoTranslateEnabled({ kind: "group_chat", groupId: "other" })).toBe(false);
    });
});

describe("autoTranslatableText", () => {
    const msg = { mine: false, inert: false, failed: false, text: () => FRENCH };

    // Invariant: the user's own messages, and inert or failed ones, are never translated, and
    // nothing is read from a message while translation is off
    test("only other people's live messages in an enabled chat are translated", () => {
        setAutoTranslate(chatId, true);
        expect(autoTranslatableText(chatId, msg)).toEqual(FRENCH);
        expect(autoTranslatableText(chatId, { ...msg, mine: true })).toBeUndefined();
        expect(autoTranslatableText(chatId, { ...msg, inert: true })).toBeUndefined();
        expect(autoTranslatableText(chatId, { ...msg, failed: true })).toBeUndefined();
        expect(autoTranslatableText(chatId, { ...msg, text: () => "" })).toBeUndefined();

        setAutoTranslate(chatId, false);
        const text = vi.fn(() => FRENCH);
        expect(autoTranslatableText(chatId, { ...msg, text })).toBeUndefined();
        expect(text).not.toHaveBeenCalled();
    });
});

describe("textsToPreload", () => {
    function message(sender: string, text: string): EventWrapper<ChatEvent> {
        return {
            event: { kind: "message", sender, content: { kind: "text_content", text } },
        } as unknown as EventWrapper<ChatEvent>;
    }

    // Invariant: preloading never looks at the user's own messages
    test("takes other people's messages, newest first", () => {
        const events = [
            message("them", "premier message"),
            message("me", "mon message"),
            { event: { kind: "direct_chat_created" } } as unknown as EventWrapper<ChatEvent>,
            message("them", ""),
            message("other", "dernier message"),
        ];
        const getText = (c: MessageContent) => (c as { text: string }).text;
        expect(textsToPreload(events, "me", getText)).toEqual([
            "dernier message",
            "premier message",
        ]);
    });
});

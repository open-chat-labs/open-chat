import { type ChatIdentifier, chatIdentifierToString } from "@client";
import { derived, get, writable, type Readable } from "svelte/store";

// Whole-chat translation using the browser's built-in Translator and LanguageDetector APIs
// (desktop Chrome / Edge). Everything runs on the device: no message text leaves the browser.
// Only messages that the virtual list has actually rendered are queued (ChatMessage registers on
// mount and unregisters on destroy), so scrolling through history costs nothing.

type Availability = "unavailable" | "downloadable" | "downloading" | "available";

interface DownloadMonitor {
    addEventListener(
        type: "downloadprogress",
        listener: (e: Event & { loaded: number }) => void,
    ): void;
}

interface CreateOptions {
    monitor?: (m: DownloadMonitor) => void;
    signal?: AbortSignal;
}

interface BrowserTranslator {
    translate(text: string, options?: { signal?: AbortSignal }): Promise<string>;
    destroy(): void;
}

interface BrowserLanguageDetector {
    detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
    destroy(): void;
}

interface TranslatorStatic {
    availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>;
    create(
        opts: { sourceLanguage: string; targetLanguage: string } & CreateOptions,
    ): Promise<BrowserTranslator>;
}

interface LanguageDetectorStatic {
    availability(): Promise<Availability>;
    create(opts?: CreateOptions): Promise<BrowserLanguageDetector>;
}

function apis():
    | { Translator: TranslatorStatic; LanguageDetector: LanguageDetectorStatic }
    | undefined {
    const g = globalThis as unknown as {
        Translator?: TranslatorStatic;
        LanguageDetector?: LanguageDetectorStatic;
    };
    if (g.Translator === undefined || g.LanguageDetector === undefined) return undefined;
    return { Translator: g.Translator, LanguageDetector: g.LanguageDetector };
}

// Our UI locale codes are not all BCP 47
const bcp47: Record<string, string> = {
    cn: "zh",
    iw: "he",
    jp: "ja",
};

export function toBcp47(locale: string | null | undefined): string {
    const code = (locale ?? "en").toLowerCase();
    return bcp47[code] ?? code.split("-")[0];
}

const MIN_CONFIDENCE = 0.6;
const MIN_LETTERS = 4;
const MAX_LENGTH = 2000;

// Tokens the translator must not touch: mentions, URLs, code spans and fenced code.
const PROTECTED = /```[\s\S]*?```|`[^`\n]+`|@UserId\([^)]*\)|@UserGroup\([^)]*\)|https?:\/\/\S+/g;

// Placeholder styles, tried in order; we use the first one that doesn't already appear in the
// message so a literal "[1]" can't be mistaken for a placeholder.
const MARKERS: [RegExp, (i: number) => string][] = [
    [/\[\d+\]/, (i) => `[${i}]`],
    [/\{\d+\}/, (i) => `{${i}}`],
    [/<\d+>/, (i) => `<${i}>`],
];

export type Protected = { text: string; tokens: string[]; marker: (i: number) => string };

export function protect(text: string): Protected | undefined {
    const style = MARKERS.find(([pattern]) => !pattern.test(text));
    if (style === undefined) return undefined;
    const marker = style[1];
    const tokens: string[] = [];
    const replaced = text.replace(PROTECTED, (m) => {
        tokens.push(m);
        return marker(tokens.length - 1);
    });
    return { text: replaced, tokens, marker };
}

export function restore(text: string, { tokens, marker }: Protected): string | undefined {
    let missing = false;
    const restored = tokens.reduce((acc, token, i) => {
        const m = marker(i);
        if (!acc.includes(m)) {
            missing = true;
            return acc;
        }
        return acc.replace(m, () => token);
    }, text);
    // If the translator mangled a placeholder we'd rather show nothing than a broken mention
    return missing ? undefined : restored;
}

function letterCount(text: string): number {
    return (text.match(/\p{L}/gu) ?? []).length;
}

export type DownloadState = { language: string; progress: number } | undefined;

type Job = { messageId: bigint; messageIndex: number; text: string };

export type AutoTranslation = { source: string; text: string; from: string };

class OnDeviceChatTranslator {
    #target = "en";
    #detector: Promise<BrowserLanguageDetector> | undefined;
    #translators = new Map<string, Promise<BrowserTranslator | undefined>>();
    #unsupportedSources = new Set<string>();
    #queue = new Map<bigint, Job>();
    #running = false;
    #awaitingActivation = false;
    #pendingResults = new Map<bigint, AutoTranslation>();
    #flushScheduled = false;
    #skipped = new Map<bigint, string>();
    #failed = false;

    // messageId -> translation. Separate from translationsStore so that writes don't
    // re-run the whole event merge, and so the original stays visible above the translation.
    readonly translations = writable(new Map<bigint, AutoTranslation>());
    readonly download = writable<DownloadState>(undefined);
    readonly error = writable<string | undefined>(undefined);
    readonly targetLanguage = writable("en");

    setTarget(locale: string | null | undefined) {
        const target = toBcp47(locale);
        if (target === this.#target) return;
        this.#target = target;
        this.#queue.clear();
        this.#clearResults();
        // Rendered messages depend on this, so they re-register for the new language
        this.targetLanguage.set(target);
    }

    get target() {
        return this.#target;
    }

    enqueue(messageId: bigint, messageIndex: number, text: string) {
        const existing = get(this.translations).get(messageId);
        if (existing?.source === text) return;
        if (this.#skipped.get(messageId) === text) return;
        this.#queue.set(messageId, { messageId, messageIndex, text });
        this.#kick();
    }

    cancel(messageId: bigint) {
        this.#queue.delete(messageId);
    }

    #clearResults() {
        this.#skipped.clear();
        this.#pendingResults.clear();
        this.#unsupportedSources.clear();
        for (const t of this.#translators.values()) {
            t.then((tr) => tr?.destroy()).catch(() => undefined);
        }
        this.#translators.clear();
        this.translations.set(new Map());
        this.download.set(undefined);
        this.error.set(undefined);
        this.#failed = false;
    }

    // Call from a click handler where possible: creating a detector or translator whose model
    // still has to download requires transient user activation.
    prime() {
        this.#kick();
    }

    #createDetector(): Promise<BrowserLanguageDetector> {
        const a = apis();
        if (a === undefined) return Promise.reject(new Error("LanguageDetector not supported"));
        const p = a.LanguageDetector.create({
            monitor: (m) =>
                m.addEventListener("downloadprogress", (e) =>
                    this.download.set(
                        e.loaded < 1 ? { language: "*", progress: e.loaded } : undefined,
                    ),
                ),
        });
        p.catch((err) => {
            this.#detector = undefined;
            this.#handleCreateError(err);
        });
        this.#detector = p;
        return p;
    }

    #translator(source: string): Promise<BrowserTranslator | undefined> {
        let p = this.#translators.get(source);
        if (p !== undefined) return p;
        const a = apis();
        if (a === undefined) return Promise.resolve(undefined);
        const target = this.#target;
        p = a.Translator.availability({ sourceLanguage: source, targetLanguage: target })
            .then((availability) => {
                if (availability === "unavailable") {
                    this.#unsupportedSources.add(source);
                    return undefined;
                }
                return a.Translator.create({
                    sourceLanguage: source,
                    targetLanguage: target,
                    monitor: (m) =>
                        m.addEventListener("downloadprogress", (e) =>
                            this.download.set(
                                e.loaded < 1 ? { language: source, progress: e.loaded } : undefined,
                            ),
                        ),
                });
            })
            .catch((err) => {
                this.#translators.delete(source);
                if (err instanceof DOMException && err.name === "NotAllowedError") throw err;
                console.warn(`On-device translation from ${source} failed: `, err);
                this.#unsupportedSources.add(source);
                return undefined;
            });
        this.#translators.set(source, p);
        return p;
    }

    #handleCreateError(err: unknown) {
        if (err instanceof DOMException && err.name === "NotAllowedError") {
            // A model needs downloading and we no longer have user activation. Wait for the
            // next interaction rather than failing.
            this.#awaitActivation();
        } else {
            console.warn("On-device translation failed: ", err);
            this.#failed = true;
            this.error.set(String(err));
        }
    }

    #awaitActivation() {
        if (this.#awaitingActivation) return;
        this.#awaitingActivation = true;
        const resume = () => {
            window.removeEventListener("pointerdown", resume, true);
            window.removeEventListener("keydown", resume, true);
            this.#awaitingActivation = false;
            this.prime();
        };
        window.addEventListener("pointerdown", resume, true);
        window.addEventListener("keydown", resume, true);
    }

    #kick() {
        if (this.#running || this.#awaitingActivation || this.#failed) return;
        if (this.#detector === undefined) this.#createDetector();
        this.#running = true;
        this.#drain().finally(() => {
            this.#running = false;
        });
    }

    #next(): Job | undefined {
        // Newest first: the user is most likely looking at the bottom of the chat
        let best: Job | undefined;
        for (const job of this.#queue.values()) {
            if (best === undefined || job.messageIndex > best.messageIndex) best = job;
        }
        if (best !== undefined) this.#queue.delete(best.messageId);
        return best;
    }

    async #drain() {
        let detector: BrowserLanguageDetector;
        try {
            detector = await this.#detector!;
        } catch {
            return;
        }
        let job: Job | undefined;
        while ((job = this.#next()) !== undefined && !this.#awaitingActivation) {
            const target = this.#target;
            try {
                const result = await this.#translate(detector, job.text);
                if (target !== this.#target) {
                    this.#queue.set(job.messageId, job);
                    continue;
                }
                if (result === undefined) {
                    this.#skipped.set(job.messageId, job.text);
                } else {
                    this.#pendingResults.set(job.messageId, { source: job.text, ...result });
                    this.#scheduleFlush();
                }
            } catch (err) {
                if (err instanceof DOMException && err.name === "NotAllowedError") {
                    // Put it back and wait for the user to interact with the page
                    this.#queue.set(job.messageId, job);
                    this.#awaitActivation();
                } else {
                    console.warn("On-device translation of a message failed: ", err);
                    this.#skipped.set(job.messageId, job.text);
                }
            }
        }
    }

    async #translate(
        detector: BrowserLanguageDetector,
        original: string,
    ): Promise<{ text: string; from: string } | undefined> {
        if (original.length > MAX_LENGTH) return undefined;
        const prot = protect(original);
        if (prot === undefined || letterCount(prot.text) < MIN_LETTERS) return undefined;
        const text = prot.text;

        const [top] = await detector.detect(text);
        if (top === undefined || top.confidence < MIN_CONFIDENCE) return undefined;
        const from = top.detectedLanguage;
        if (from === "und" || toBcp47(from) === this.#target) return undefined;
        if (this.#unsupportedSources.has(from)) return undefined;

        const translator = await this.#translator(from);
        if (translator === undefined) return undefined;

        const translated = restore(await translator.translate(text), prot);
        return translated === undefined ? undefined : { text: translated, from };
    }

    // Batch store writes so a screenful of results re-renders once, not once per message
    #scheduleFlush() {
        if (this.#flushScheduled) return;
        this.#flushScheduled = true;
        setTimeout(() => {
            this.#flushScheduled = false;
            const pending = this.#pendingResults;
            this.#pendingResults = new Map();
            this.translations.update((map) => {
                const next = new Map(map);
                pending.forEach((v, k) => next.set(k, v));
                return next;
            });
        }, 100);
    }
}

export const onDeviceTranslator = new OnDeviceChatTranslator();

let supportPromise: Promise<boolean> | undefined;

// True when this browser exposes both APIs and they aren't flatly unavailable. Chrome reports
// language pairs as "downloadable" until the site has used them, so this can't say which pairs are
// on disk, only that the feature can work here.
export function onDeviceTranslationSupported(): Promise<boolean> {
    supportPromise ??= (async () => {
        const a = apis();
        if (a === undefined) return false;
        try {
            const [detector, pair] = await Promise.all([
                a.LanguageDetector.availability(),
                a.Translator.availability({ sourceLanguage: "en", targetLanguage: "es" }),
            ]);
            return detector !== "unavailable" && pair !== "unavailable";
        } catch {
            return false;
        }
    })();
    return supportPromise;
}

const STORAGE_KEY = "openchat_auto_translate_chats";

function loadChats(): Set<string> {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return new Set(stored ? (JSON.parse(stored) as string[]) : []);
    } catch {
        return new Set();
    }
}

const autoTranslateChats = writable<Set<string>>(loadChats());

autoTranslateChats.subscribe((chats) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...chats]));
    } catch {
        // storage unavailable; the toggle just won't be remembered
    }
});

export function autoTranslateEnabled(chatId: ChatIdentifier): Readable<boolean> {
    const key = chatIdentifierToString(chatId);
    return derived(autoTranslateChats, (chats) => chats.has(key));
}

export function setAutoTranslate(chatId: ChatIdentifier, enabled: boolean) {
    const key = chatIdentifierToString(chatId);
    autoTranslateChats.update((chats) => {
        const next = new Set(chats);
        if (enabled) {
            next.add(key);
        } else {
            next.delete(key);
        }
        return next;
    });
    if (enabled) {
        onDeviceTranslator.prime();
    }
}

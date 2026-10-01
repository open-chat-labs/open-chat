import { type ChatIdentifier, chatIdentifierToString } from "@client";
import { untrack } from "svelte";
import { SvelteMap, SvelteSet } from "svelte/reactivity";

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

type Job = { messageId: bigint; messageIndex: number; text: string };

export type AutoTranslation = { source: string; text: string; from: string };

type DetectedJob = Job & { from: string; prot: Protected };

function hasUserActivation(): boolean {
    return (
        (navigator as { userActivation?: { isActive: boolean } }).userActivation?.isActive ?? false
    );
}

function isNotAllowed(err: unknown): boolean {
    return err instanceof DOMException && err.name === "NotAllowedError";
}

// enqueue, cancel and setTarget are called from component effects, so they read reactive state
// untracked: otherwise every message's effect would re-run whenever another message is translated.
class OnDeviceChatTranslator {
    #target = $state("en");
    #error = $state<string | undefined>(undefined);
    #detector: Promise<BrowserLanguageDetector> | undefined;
    #translators = new Map<string, BrowserTranslator>();
    #creating = new Map<string, Promise<void>>();
    #unsupportedSources = new Set<string>();
    #queue = new Map<bigint, Job>();
    // Detected jobs waiting on a language pack, keyed by source language
    #parked = new Map<string, Map<bigint, DetectedJob>>();
    #running = false;
    #pendingResults = new Map<bigint, AutoTranslation>();
    #flushScheduled = false;
    #skipped = new Map<bigint, string>();
    #failed = false;

    // messageId -> translation. Separate from translationsStore so that writes don't
    // re-run the whole event merge, and so the original stays visible above the translation.
    readonly translations = new SvelteMap<bigint, AutoTranslation>();
    // Language packs being downloaded, source language -> progress (0..1)
    readonly downloads = new SvelteMap<string, number>();
    // Source languages whose packs need downloading but we had no user gesture to start them
    readonly needsDownload = new SvelteSet<string>();
    // messageId -> detected source language, for messages waiting on a language pack
    readonly waiting = new SvelteMap<bigint, string>();

    setTarget(locale: string | null | undefined) {
        const target = toBcp47(locale);
        if (target === untrack(() => this.#target)) return;
        // Rendered messages depend on this, so they re-register for the new language
        this.#target = target;
        this.#queue.clear();
        this.#clearResults();
    }

    get target() {
        return this.#target;
    }

    get error() {
        return this.#error;
    }

    enqueue(messageId: bigint, messageIndex: number, text: string) {
        const existing = untrack(() => this.translations.get(messageId));
        if (existing?.source === text) return;
        if (this.#skipped.get(messageId) === text) return;
        this.#queue.set(messageId, { messageId, messageIndex, text });
        this.#kick();
    }

    cancel(messageId: bigint) {
        this.#queue.delete(messageId);
        for (const jobs of this.#parked.values()) {
            jobs.delete(messageId);
        }
        this.waiting.delete(messageId);
    }

    #clearResults() {
        this.#skipped.clear();
        this.#pendingResults.clear();
        this.#unsupportedSources.clear();
        this.#parked.clear();
        this.waiting.clear();
        this.#creating.clear();
        for (const t of this.#translators.values()) {
            t.destroy();
        }
        this.#translators.clear();
        this.translations.clear();
        this.downloads.clear();
        this.needsDownload.clear();
        this.#error = undefined;
        this.#failed = false;
    }

    // Call from a click handler: creating a detector or translator whose model still has to
    // download requires transient user activation. Starts every language pack we know we need.
    prime() {
        for (const source of [...this.needsDownload]) {
            this.#startTranslator(source);
        }
        this.#kick();
    }

    // Detects the language of every message already loaded (not just the rendered ones) and starts
    // downloading any missing language packs while the user's click still counts as activation,
    // so languages further up the chat are usually ready by the time they scroll into view.
    async preload(texts: string[]) {
        if (this.#detector === undefined) this.#createDetector();
        let detector: BrowserLanguageDetector;
        try {
            detector = await this.#detector!;
        } catch {
            return;
        }
        const seen = new Set<string>();
        for (const text of texts) {
            if (!hasUserActivation()) return;
            const prot = protect(text);
            if (prot === undefined || letterCount(prot.text) < MIN_LETTERS) continue;
            try {
                const [top] = await detector.detect(prot.text);
                if (top === undefined || top.confidence < MIN_CONFIDENCE) continue;
                const from = top.detectedLanguage;
                if (from === "und" || toBcp47(from) === this.#target || seen.has(from)) continue;
                seen.add(from);
                await this.#ensureTranslator(from);
            } catch {
                // best effort
            }
        }
    }

    #createDetector(): Promise<BrowserLanguageDetector> {
        const a = apis();
        if (a === undefined) return Promise.reject(new Error("LanguageDetector not supported"));
        const p = a.LanguageDetector.create();
        p.catch((err) => {
            this.#detector = undefined;
            if (!isNotAllowed(err)) {
                console.warn("On-device language detection failed: ", err);
                this.#failed = true;
                this.#error = String(err);
            }
        });
        this.#detector = p;
        return p;
    }

    #setProgress(source: string, progress: number | undefined) {
        if (progress === undefined || progress >= 1) {
            this.downloads.delete(source);
        } else {
            this.downloads.set(source, progress);
        }
    }

    #setNeedsDownload(source: string, needed: boolean) {
        if (needed) {
            this.needsDownload.add(source);
        } else {
            this.needsDownload.delete(source);
        }
    }

    // Starts creating (and, if necessary, downloading) the translator for a source language
    // without blocking the queue. Parked jobs for that language are released when it's ready.
    #startTranslator(source: string, downloading = true) {
        if (this.#translators.has(source) || this.#creating.has(source)) return;
        const a = apis();
        if (a === undefined) return;
        const target = this.#target;
        this.#setNeedsDownload(source, false);
        const p = a.Translator.create({
            sourceLanguage: source,
            targetLanguage: target,
            // Chrome fires progress events even for packs already on disk, so only report
            // progress when we know a download is actually happening
            monitor: downloading
                ? (m) =>
                      m.addEventListener("downloadprogress", (e) =>
                          this.#setProgress(source, e.loaded),
                      )
                : undefined,
        })
            .then((translator) => {
                if (target !== this.#target) {
                    translator.destroy();
                    return;
                }
                this.#translators.set(source, translator);
                this.#release(source);
            })
            .catch((err) => {
                if (target !== this.#target) return;
                if (isNotAllowed(err)) {
                    // The gesture expired before we got here; offer a button instead
                    this.#setNeedsDownload(source, true);
                } else {
                    console.warn(`On-device translation from ${source} failed: `, err);
                    this.#unsupportedSources.add(source);
                    this.#dropParked(source);
                }
            })
            .finally(() => {
                this.#creating.delete(source);
                this.#setProgress(source, undefined);
            });
        this.#creating.set(source, p);
    }

    #release(source: string) {
        const jobs = this.#parked.get(source);
        this.#parked.delete(source);
        if (jobs === undefined) return;
        for (const job of jobs.values()) {
            this.waiting.delete(job.messageId);
            this.#queue.set(job.messageId, job);
        }
        this.#kick();
    }

    #dropParked(source: string) {
        const jobs = this.#parked.get(source);
        this.#parked.delete(source);
        for (const id of jobs?.keys() ?? []) {
            this.waiting.delete(id);
        }
    }

    #park(job: DetectedJob) {
        let jobs = this.#parked.get(job.from);
        if (jobs === undefined) {
            jobs = new Map();
            this.#parked.set(job.from, jobs);
        }
        jobs.set(job.messageId, job);
        this.waiting.set(job.messageId, job.from);
    }

    #kickScheduled = false;

    // Never do translation work in the same task as rendering the chat: wait until the browser
    // is idle so loading messages always comes first
    #kick() {
        if (this.#kickScheduled || this.#running || this.#failed) return;
        this.#kickScheduled = true;
        const run = () => {
            this.#kickScheduled = false;
            this.#run();
        };
        if ("requestIdleCallback" in window) {
            requestIdleCallback(run, { timeout: 500 });
        } else {
            setTimeout(run, 50);
        }
    }

    #run() {
        if (this.#running || this.#failed) return;
        if (this.#detector === undefined) this.#createDetector();
        this.#running = true;
        this.#drain().finally(() => {
            this.#running = false;
        });
    }

    #next(): Job | DetectedJob | undefined {
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
        // Pass 1: detect every queued message and start any missing language packs straight
        // away, in parallel, while the user's click still counts as activation.
        const ready: DetectedJob[] = [];
        let job: Job | DetectedJob | undefined;
        while ((job = this.#next()) !== undefined) {
            const detected = "from" in job ? job : await this.#detect(detector, job);
            if (detected === undefined) continue;
            if (this.#translators.has(detected.from)) {
                ready.push(detected);
            } else if (!this.#unsupportedSources.has(detected.from)) {
                this.#park(detected);
                await this.#ensureTranslator(detected.from);
            }
        }

        // Pass 2: translate what we can, newest first
        ready.sort((a, b) => b.messageIndex - a.messageIndex);
        for (const d of ready) {
            const target = this.#target;
            const translator = this.#translators.get(d.from);
            if (translator === undefined) continue;
            try {
                const translated = restore(await translator.translate(d.prot.text), d.prot);
                if (target !== this.#target) continue;
                if (translated === undefined) {
                    this.#skipped.set(d.messageId, d.text);
                } else {
                    this.#pendingResults.set(d.messageId, {
                        source: d.text,
                        text: translated,
                        from: d.from,
                    });
                    this.#scheduleFlush();
                }
            } catch (err) {
                console.warn("On-device translation of a message failed: ", err);
                this.#skipped.set(d.messageId, d.text);
            }
        }

        // Anything that arrived while we were translating
        if (this.#queue.size > 0) await this.#drain();
    }

    async #detect(detector: BrowserLanguageDetector, job: Job): Promise<DetectedJob | undefined> {
        const skip = () => {
            this.#skipped.set(job.messageId, job.text);
            return undefined;
        };
        if (job.text.length > MAX_LENGTH) return skip();
        const prot = protect(job.text);
        if (prot === undefined || letterCount(prot.text) < MIN_LETTERS) return skip();
        try {
            const [top] = await detector.detect(prot.text);
            if (top === undefined || top.confidence < MIN_CONFIDENCE) return skip();
            const from = top.detectedLanguage;
            if (from === "und" || toBcp47(from) === this.#target) return skip();
            if (this.#unsupportedSources.has(from)) return skip();
            return { ...job, from, prot };
        } catch (err) {
            console.warn("On-device language detection of a message failed: ", err);
            return skip();
        }
    }

    async #ensureTranslator(source: string) {
        if (this.#translators.has(source) || this.#creating.has(source)) return;
        if (this.needsDownload.has(source)) return;
        const a = apis();
        if (a === undefined) return;
        let availability: Availability;
        try {
            availability = await a.Translator.availability({
                sourceLanguage: source,
                targetLanguage: this.#target,
            });
        } catch {
            availability = "unavailable";
        }
        if (availability === "unavailable") {
            this.#unsupportedSources.add(source);
            this.#dropParked(source);
        } else if (availability === "available") {
            this.#startTranslator(source, false);
        } else if (hasUserActivation()) {
            this.#startTranslator(source);
        } else {
            this.#setNeedsDownload(source, true);
        }
    }

    // Batch writes so a screenful of results re-renders once, not once per message
    #scheduleFlush() {
        if (this.#flushScheduled) return;
        this.#flushScheduled = true;
        setTimeout(() => {
            this.#flushScheduled = false;
            const pending = this.#pendingResults;
            this.#pendingResults = new Map();
            pending.forEach((v, k) => this.translations.set(k, v));
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

const autoTranslateChats = new SvelteSet<string>(loadChats());

export function autoTranslateEnabled(chatId: ChatIdentifier): boolean {
    return autoTranslateChats.has(chatIdentifierToString(chatId));
}

// Call from a click handler. `loadedTexts` are the chat's already loaded messages, newest first.
export function setAutoTranslate(
    chatId: ChatIdentifier,
    enabled: boolean,
    loadedTexts: string[] = [],
) {
    const key = chatIdentifierToString(chatId);
    if (enabled) {
        autoTranslateChats.add(key);
    } else {
        autoTranslateChats.delete(key);
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...autoTranslateChats]));
    } catch {
        // storage unavailable; the toggle just won't be remembered
    }
    if (enabled) {
        onDeviceTranslator.prime();
        void onDeviceTranslator.preload(loadedTexts);
    }
}

// Intl.DisplayNames is expensive to construct, so keep one per UI locale
const displayNames = new Map<string, Intl.DisplayNames | undefined>();

export function languageName(code: string, uiLocale: string | null | undefined): string {
    const key = uiLocale ?? "en";
    if (!displayNames.has(key)) {
        try {
            displayNames.set(key, new Intl.DisplayNames([key], { type: "language" }));
        } catch {
            displayNames.set(key, undefined);
        }
    }
    try {
        return displayNames.get(key)?.of(code) ?? code;
    } catch {
        return code;
    }
}

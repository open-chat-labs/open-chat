// A tiny localStorage ring-buffer of uncaught errors so that users who cannot
// access a console (mobile PWA) can still report what actually went wrong.
// This must never throw - it is called from error handlers.

const KEY = "oc_crash_log";
const MAX_ENTRIES = 20;

export type CrashLogEntry = {
    ts: string;
    source: string;
    message: string;
    stack?: string;
};

export function recordError(source: string, err: unknown): void {
    try {
        const entry: CrashLogEntry = {
            ts: new Date().toISOString(),
            source,
            message: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
            stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
        };
        const log = readCrashLog();
        log.push(entry);
        localStorage.setItem(KEY, JSON.stringify(log.slice(-MAX_ENTRIES)));
    } catch {
        // diagnostics must never take the app down
    }
}

export function readCrashLog(): CrashLogEntry[] {
    try {
        const raw = localStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function clearCrashLog(): void {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // ignore
    }
}

export function formatCrashLog(): string {
    const log = readCrashLog();
    if (log.length === 0) return "No errors recorded";
    return log
        .map((e) => `${e.ts} [${e.source}] ${e.message}${e.stack ? "\n" + e.stack : ""}`)
        .join("\n\n");
}

// Pull the underlying error out of a window error / unhandledrejection event
export function eventToError(ev: Event): unknown {
    if (ev instanceof PromiseRejectionEvent) return ev.reason;
    if (ev instanceof ErrorEvent) return ev.error ?? ev.message;
    return ev;
}

// Chrome on Android closes IndexedDB connections when the app is backgrounded.
// Any in-flight cache operation (most commonly the emoji database's fire-and-forget
// background update check) then rejects with this error. The connection is re-opened
// on next use so nothing is actually broken - keep these out of the crash log.
export function isIdbConnectionClosingError(err: unknown): boolean {
    return (
        err instanceof DOMException &&
        err.name === "InvalidStateError" &&
        err.message.includes("database connection is closing")
    );
}

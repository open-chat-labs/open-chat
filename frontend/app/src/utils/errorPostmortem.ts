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

const MAX_MESSAGE = 2000;

// Non-Error values (plain objects, OC error responses, DOMExceptions on old
// browsers) used to be logged via String(), which yields "[object Object]".
export function describeError(err: unknown): string {
    if (err instanceof Error) return `${err.name}: ${err.message}`;
    if (typeof err === "string") return err;
    if (err === null || typeof err !== "object") return String(err);
    const { name, message } = err as { name?: unknown; message?: unknown };
    if (typeof message === "string") {
        return typeof name === "string" && name !== "" ? `${name}: ${message}` : message;
    }
    try {
        const seen = new WeakSet<object>();
        return JSON.stringify(err, (_k, v) => {
            if (typeof v === "bigint") return v.toString();
            if (typeof v === "function") return `[function ${v.name}]`;
            if (v !== null && typeof v === "object") {
                if (seen.has(v)) return "[circular]";
                seen.add(v);
            }
            return v;
        }).slice(0, MAX_MESSAGE);
    } catch {
        return Object.prototype.toString.call(err);
    }
}

function stackOf(err: unknown): string | undefined {
    const stack = (err as { stack?: unknown } | null)?.stack;
    return typeof stack === "string" ? stack.slice(0, 2000) : undefined;
}

export function recordError(source: string, err: unknown): void {
    try {
        const entry: CrashLogEntry = {
            ts: new Date().toISOString(),
            source,
            message: describeError(err),
            stack: stackOf(err),
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

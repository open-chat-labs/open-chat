/* eslint-disable @typescript-eslint/no-explicit-any */
// Scroll diagnostics for the virtualised chat list.
//
// Zero-cost when disabled. Enable with localStorage.setItem("vcl_debug", "1")
// (or a ?vcldebug query param) and reload. All instrumentation writes compact
// entries into an in-memory ring buffer exposed at window.__vclDebug:
//
//   __vclDebug.dump(500)     — last N entries as text lines
//   __vclDebug.anomalies()   — only the "!"-tagged entries (jumps, shifts, drift)
//   __vclDebug.stats()       — entry counts per tag
//   __vclDebug.clear()
//
// Anomaly tags (prefixed "!") are also mirrored to console.warn so they are
// visible in a normal devtools session without pulling the buffer.

export type VclLogEntry = { t: number; tag: string } & Record<string, unknown>;

const MAX_ENTRIES = 8000;

class VclDebug {
    #buffer: VclLogEntry[] = [];
    #head = 0;
    #enabled = false;

    constructor() {
        try {
            this.#enabled =
                (typeof localStorage !== "undefined" &&
                    localStorage.getItem("vcl_debug") === "1") ||
                (typeof location !== "undefined" && location.search.includes("vcldebug"));
        } catch {
            this.#enabled = false;
        }
    }

    get enabled(): boolean {
        return this.#enabled;
    }

    enable() {
        this.#enabled = true;
        try {
            localStorage.setItem("vcl_debug", "1");
        } catch {
            // ignore
        }
    }

    disable() {
        this.#enabled = false;
        try {
            localStorage.removeItem("vcl_debug");
        } catch {
            // ignore
        }
    }

    log(tag: string, data: Record<string, unknown> = {}) {
        if (!this.#enabled) return;
        const e: VclLogEntry = { t: Math.round(performance.now()), tag, ...data };
        if (this.#buffer.length < MAX_ENTRIES) {
            this.#buffer.push(e);
        } else {
            this.#buffer[this.#head] = e;
            this.#head = (this.#head + 1) % MAX_ENTRIES;
        }
        if (tag.startsWith("!")) {
            console.warn("[vcl]", tag, data);
        }
    }

    entries(): VclLogEntry[] {
        if (this.#buffer.length < MAX_ENTRIES) return [...this.#buffer];
        return [...this.#buffer.slice(this.#head), ...this.#buffer.slice(0, this.#head)];
    }

    anomalies(): VclLogEntry[] {
        return this.entries().filter((e) => e.tag.startsWith("!"));
    }

    stats(): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const e of this.entries()) {
            counts[e.tag] = (counts[e.tag] ?? 0) + 1;
        }
        return counts;
    }

    dump(last = 500): string {
        return this.entries()
            .slice(-last)
            .map((e) => {
                const { t, tag, ...rest } = e;
                const fields = Object.entries(rest)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(" ");
                return `${t} ${tag} ${fields}`;
            })
            .join("\n");
    }

    clear() {
        this.#buffer = [];
        this.#head = 0;
    }
}

export const vclDebug = new VclDebug();

if (typeof window !== "undefined") {
    (window as any).__vclDebug = vclDebug;
}

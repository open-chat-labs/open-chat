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

function formatEntry(e: VclLogEntry): string {
    const { t, tag, ...rest } = e;
    const fields = Object.entries(rest)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
    return `${t} ${tag} ${fields}`;
}

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
        if (this.#enabled) {
            this.#startPostmortem();
        }
    }

    // While enabled, persist the log tail every 500ms so that when the
    // renderer locks up and the tab has to be killed, the next session can
    // print what the list was doing at the moment of death.
    #startPostmortem() {
        try {
            const prev = localStorage.getItem("vcl_postmortem");
            if (prev !== null) {
                const parsed = JSON.parse(prev);
                console.warn(
                    `VCL POSTMORTEM — previous session's last heartbeat ${parsed.t}, tail:\n` +
                        parsed.tail.join("\n"),
                );
                localStorage.removeItem("vcl_postmortem");
            }
        } catch {
            // ignore
        }
        setInterval(() => {
            try {
                localStorage.setItem(
                    "vcl_postmortem",
                    JSON.stringify({
                        t: new Date().toISOString(),
                        tail: this.#tail(40).map(formatEntry),
                    }),
                );
            } catch {
                // ignore
            }
        }, 500);
        // a clean unload should not masquerade as a lockup
        window.addEventListener("beforeunload", () => {
            try {
                localStorage.removeItem("vcl_postmortem");
            } catch {
                // ignore
            }
        });
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

    // Last n entries without cloning/reordering the whole ring buffer — the
    // postmortem beacon calls this every 500ms, during exactly the load
    // spikes it exists to capture.
    #tail(n: number): VclLogEntry[] {
        const len = this.#buffer.length;
        if (len < MAX_ENTRIES) return this.#buffer.slice(-n);
        const out: VclLogEntry[] = [];
        for (let i = Math.max(0, len - n); i < len; i++) {
            out.push(this.#buffer[(this.#head + i) % len]);
        }
        return out;
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
        return this.#tail(last).map(formatEntry).join("\n");
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

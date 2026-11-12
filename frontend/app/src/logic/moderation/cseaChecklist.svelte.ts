// The moderators' manual NCA report checklist (/csea-reporting): how the material was detected,
// the report's priority, the items ticked, and whether a call to the NCA is needed after
// submitting. Its progress is kept in this browser per report (`?report=`), so a reviewer can come
// back to it. Shared by the old desktop page and the web's (#9239, #10132).

export type CseaOrigin = "hash" | "manual";
export type CseaPriority = 1 | 2 | 3;

type Saved = {
    origin?: CseaOrigin;
    priority?: CseaPriority;
    ticks: Record<string, boolean>;
};

/**
 * Whether someone sees the checklist: platform moderators and operators only. Everyone else is told
 * where to report material instead.
 */
export function showsCseaChecklist(platformModerator: boolean, platformOperator: boolean): boolean {
    return platformModerator || platformOperator;
}

/** Where a report's progress is kept: one key per `?report=` id, and one for a checklist without one. */
export function cseaStorageKey(report: string | undefined): string {
    return `csea_checklist_${report ?? "adhoc"}`;
}

/** The hour (0–23) in the UK at `at`, which the NCA's call rule goes by. */
export function ukHour(at: Date): number {
    // "en-GB" with hour12 off writes midnight as 0 (some engines write 24, which is the next day's 0)
    const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/London",
            hour: "numeric",
            hourCycle: "h23",
        }).format(at),
    );
    return hour % 24;
}

/** The time in the UK at `at`, as "HH:MM". */
export function ukTime(at: Date): string {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(at);
}

/** Whether a UK hour is outside the NCA's 07:00–17:00 day. */
export function outsideNcaHours(hour: number): boolean {
    return hour < 7 || hour >= 17;
}

/**
 * Whether a report needs a call to the NCA control centre after it's submitted: exactly a Priority
 * 1 or 2 report submitted outside 07:00–17:00 UK time.
 */
export function ncaCallRequired(priority: CseaPriority | undefined, hour: number): boolean {
    return (priority === 1 || priority === 2) && outsideNcaHours(hour);
}

function parseSaved(raw: string | null): Saved | undefined {
    if (raw === null) return undefined;
    try {
        const parsed: Partial<Saved> = JSON.parse(raw);
        return { origin: parsed.origin, priority: parsed.priority, ticks: parsed.ticks ?? {} };
    } catch {
        // corrupt state starts afresh
        return undefined;
    }
}

/** A report's checklist, restored from what was kept for it and kept on every change. */
export class CseaChecklist {
    origin = $state<CseaOrigin | undefined>(undefined);
    priority = $state<CseaPriority | undefined>(undefined);
    ticks = $state<Record<string, boolean>>({});
    readonly #key: string;

    constructor(
        readonly report: string | undefined,
        private readonly storage:
            | Pick<Storage, "getItem" | "setItem">
            | undefined = safeLocalStorage(),
    ) {
        this.#key = cseaStorageKey(report);
        const saved = parseSaved(this.#read());
        if (saved !== undefined) {
            this.origin = saved.origin;
            this.priority = saved.priority;
            this.ticks = saved.ticks;
        }
    }

    get tickedCount(): number {
        return Object.values(this.ticks).filter((v) => v).length;
    }

    isTicked(id: string): boolean {
        return this.ticks[id] === true;
    }

    /** Whether a call to the NCA is needed after submitting at `at` (ncaCallRequired). */
    callRequired(at: Date): boolean {
        return ncaCallRequired(this.priority, ukHour(at));
    }

    setOrigin(origin: CseaOrigin): void {
        this.origin = origin;
        this.#save();
    }

    setPriority(priority: CseaPriority): void {
        this.priority = priority;
        this.#save();
    }

    toggle(id: string): void {
        this.ticks = { ...this.ticks, [id]: !this.isTicked(id) };
        this.#save();
    }

    reset(): void {
        this.origin = undefined;
        this.priority = undefined;
        this.ticks = {};
        this.#save();
    }

    #read(): string | null {
        try {
            return this.storage?.getItem(this.#key) ?? null;
        } catch {
            return null;
        }
    }

    #save(): void {
        const saved: Saved = { origin: this.origin, priority: this.priority, ticks: this.ticks };
        try {
            this.storage?.setItem(this.#key, JSON.stringify(saved));
        } catch {
            // nowhere to keep it (storage off or full): the checklist still works for this visit
        }
    }
}

function safeLocalStorage(): Storage | undefined {
    try {
        return typeof localStorage === "undefined" ? undefined : localStorage;
    } catch {
        return undefined;
    }
}

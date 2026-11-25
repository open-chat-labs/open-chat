import type { DailyPuzzleConfig, OCError, OpenChat, ResourceKey, Success } from "@client";
import { i18nKey } from "@i18n/i18n";
import { SvelteSet } from "svelte/reactivity";

// The daily puzzle's operator functions (the old desktop's `home/admin/DailyPuzzleOperator`, and
// the new UI's admin screen). Two levers, deliberately (2026-09-13, #9357): the kill switch, and
// regenerating a bad puzzle. Prices, rewards, caps and the rota are code, so changing them gets a
// review. The game picker's options are `regenerateOptions` (utils/dailyPuzzleOperator).

export type DailyPuzzleLever = "enabled" | "regenerate";

export type DailyPuzzleOutcome =
    | { kind: "success"; message: ResourceKey }
    | { kind: "failed"; message: ResourceKey };

/** Hears each outcome as it happens: a success, then any failure reading the config back. */
export type DailyPuzzleReport = (outcome: DailyPuzzleOutcome) => void;

type DailyPuzzleClient = Pick<
    OpenChat,
    | "dailyPuzzleConfig"
    | "dailyPuzzleSetEnabled"
    | "dailyPuzzleRegenerateToday"
    | "dailyPuzzleFetch"
>;

/** "{what}: {detail}", the detail the error's message or code, or whatever was thrown. */
export function dailyPuzzleFailure(what: string, resp: OCError | unknown): ResourceKey {
    const detail =
        typeof resp === "object" && resp !== null && "kind" in resp && resp.kind === "error"
            ? ((resp as OCError).message ?? `code ${(resp as OCError).code}`)
            : String(resp);
    return i18nKey(`${what}: ${detail}`);
}

export function regeneratedMessage(gameId: string | undefined): string {
    return `Today's puzzle regenerated${gameId === undefined ? " as scheduled" : ` as ${gameId}`}`;
}

export class DailyPuzzleOperator {
    /** What the canister holds now, never what was just sent. */
    config = $state<DailyPuzzleConfig | undefined>(undefined);
    /** The toggle's value, to save. */
    enabled = $state(false);
    /** The game to regenerate as; blank is as scheduled. */
    regenerateGameId = $state("");
    error = $state<ResourceKey | undefined>(undefined);
    readonly busy = new SvelteSet<DailyPuzzleLever>();
    #client: DailyPuzzleClient;

    constructor(client: DailyPuzzleClient) {
        this.#client = client;
    }

    /** Reads the config; a failure comes back to be shown. */
    async refresh(): Promise<DailyPuzzleOutcome | undefined> {
        const current = await this.#client.dailyPuzzleConfig();
        if ("kind" in current) {
            return this.#fail("Failed to read the daily puzzle config", current);
        }
        this.config = current;
        this.enabled = current.enabled;
        return undefined;
    }

    /** Saves the toggle's value. */
    saveEnabled(report: DailyPuzzleReport): Promise<void> {
        const enabled = this.enabled;
        return this.#run(
            "enabled",
            "Failed to set the daily puzzle enabled flag",
            () => this.#client.dailyPuzzleSetEnabled(enabled),
            `Daily puzzle ${enabled ? "enabled" : "disabled"}; pushed to every local user index`,
            report,
        );
    }

    regenerateToday(report: DailyPuzzleReport): Promise<void> {
        const gameId = this.regenerateGameId === "" ? undefined : this.regenerateGameId;
        return this.#run(
            "regenerate",
            "Regenerate failed",
            () => this.#client.dailyPuzzleRegenerateToday(gameId),
            regeneratedMessage(gameId),
            report,
        );
    }

    #fail(what: string, resp: OCError | unknown): DailyPuzzleOutcome {
        this.error = dailyPuzzleFailure(what, resp);
        return { kind: "failed", message: this.error };
    }

    async #run(
        lever: DailyPuzzleLever,
        what: string,
        action: () => Promise<Success | OCError>,
        successMessage: string,
        report: DailyPuzzleReport,
    ): Promise<void> {
        this.error = undefined;
        this.busy.add(lever);
        try {
            const resp = await action();
            if (resp.kind === "success") {
                report({ kind: "success", message: i18nKey(successMessage) });
                const failed = await this.refresh();
                if (failed !== undefined) report(failed);
                // The operator's own client sees the change now, not at the next poll
                await this.#client.dailyPuzzleFetch();
            } else {
                report(this.#fail(what, resp));
            }
        } catch (err) {
            report(this.#fail(what, err));
        } finally {
            this.busy.delete(lever);
        }
    }
}

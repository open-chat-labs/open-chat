import type { DailyResultContent, OpenChat } from "@client";
import { SvelteMap } from "svelte/reactivity";
import { verificationFrom, type CardVerification } from "./dailyResultCard";

/**
 * A conversation's result cards checked against the daily canister's results index
 * (`verifyDailyResults`, which caches and batches), each card once, the first time it's shown.
 * What came back is reactive, so a card shown "pending" updates when its answer lands.
 */
export class DailyResultVerifier {
    #results = new SvelteMap<string, CardVerification>();
    // the cards asked about: not reactive, so asking while rows are made changes no state they read
    #asked = new Set<string>();

    constructor(private client: Pick<OpenChat, "verifyDailyResults">) {}

    /** What's known about a card: pending until its answer lands (asked for the first time here). */
    verification(content: DailyResultContent): CardVerification {
        const key = cardKey(content);
        const known = this.#results.get(key);
        if (known !== undefined) return known;
        if (!this.#asked.has(key)) {
            this.#asked.add(key);
            void this.#verify(key, content);
        }
        return { kind: "pending" };
    }

    async #verify(key: string, content: DailyResultContent): Promise<void> {
        try {
            const rows = await this.client.verifyDailyResults(content.gameId, content.number, [
                content.userId,
            ]);
            this.#results.set(key, verificationFrom(rows, content.userId));
        } catch (err) {
            // asked again the next time the card is shown
            console.warn("Couldn't verify a daily puzzle result", err);
            this.#asked.delete(key);
        }
    }
}

function cardKey(content: DailyResultContent): string {
    return `${content.gameId}:${content.number}:${content.userId}`;
}

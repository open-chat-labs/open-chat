import type {
    CandidateTranslations,
    OpenChat,
    RejectReason,
    ResourceKey,
    TranslationCorrection,
} from "@client";
import { i18nKey } from "@i18n/i18n";
import { locale } from "svelte-i18n";
import { SvelteSet } from "svelte/reactivity";

// The operator console's translation corrections (the old desktop's
// `home/admin/ReviewTranslationCorrections`, and the new UI's admin screen): the corrections users
// proposed, one row each, sorted by key, to preview, check in English, approve or reject.

type CorrectionsClient = Pick<
    OpenChat,
    | "getProposedTranslationCorrections"
    | "refreshTranslationsBalance"
    | "approveTranslationCorrection"
    | "rejectTranslationCorrection"
    | "translateText"
>;

export type CorrectionOutcome = { kind: "success" } | { kind: "failed"; message: ResourceKey };

export const TRANSLATING_PLACEHOLDER = "Translating to English ...";
export const TRANSLATION_UNAVAILABLE = "Unable to get english translation at the moment";

export function flattenCorrections(corrections: CandidateTranslations[]): TranslationCorrection[] {
    return corrections
        .flatMap((group) =>
            group.candidates.map((correction) => ({
                id: correction.id,
                locale: group.locale,
                key: group.key,
                value: correction.value,
                proposedBy: correction.proposedBy,
                proposedAt: correction.proposedAt,
            })),
        )
        .sort((a, b) => a.key.localeCompare(b.key));
}

/** The locales the corrections are for, each once, in the order they first appear. */
export function requiredLocales(corrections: TranslationCorrection[]): string[] {
    return [...new Set(corrections.map((c) => c.locale))];
}

// Since the locales are lazy loaded, we load the current translations of each locale we have
// corrections for (by switching to it), then switch back to the locale in use.
export async function loadLocales(locales: string[]): Promise<void> {
    let currentLocale: string | null | undefined;
    locale.subscribe((l) => (currentLocale = l))();
    for (const l of locales) {
        await locale.set(l);
    }
    await locale.set(currentLocale);
}

export class TranslationCorrections {
    corrections = $state<TranslationCorrection[]>([]);
    /** The correction shown in English instead of as proposed, if any. */
    verifying = $state<TranslationCorrection | undefined>(undefined);
    chatBalance = $state(0n);
    refreshing = $state(false);
    /** The corrections whose approval or rejection is under way. */
    readonly processing = new SvelteSet<bigint>();
    #verifications: Record<number, string> = {};
    #client: CorrectionsClient;
    #loadLocales: (locales: string[]) => Promise<void>;

    constructor(
        client: CorrectionsClient,
        loadRequiredLocales: (locales: string[]) => Promise<void> = loadLocales,
    ) {
        this.#client = client;
        this.#loadLocales = loadRequiredLocales;
    }

    async load(): Promise<void> {
        const res = await this.#client.getProposedTranslationCorrections();
        const corrections = flattenCorrections(res);
        await this.#loadLocales(requiredLocales(corrections));
        this.corrections = corrections;
    }

    async refreshBalance(): Promise<void> {
        this.refreshing = true;
        try {
            this.chatBalance = await this.#client.refreshTranslationsBalance();
        } finally {
            this.refreshing = false;
        }
    }

    /** What the proposed value column shows: the English of the one being verified. */
    proposedValue(correction: TranslationCorrection): string {
        return this.isVerifying(correction) && this.verifying !== undefined
            ? this.verifying.value
            : correction.value;
    }

    isVerifying(correction: TranslationCorrection): boolean {
        return this.verifying !== undefined && this.verifying.id === correction.id;
    }

    async approve({ id }: TranslationCorrection): Promise<CorrectionOutcome> {
        this.processing.add(id);
        try {
            if (await this.#client.approveTranslationCorrection(id)) {
                this.#remove(id);
                return { kind: "success" };
            }
            return {
                kind: "failed",
                message: i18nKey("Sorry we were unable to approve this correction"),
            };
        } finally {
            this.processing.delete(id);
        }
    }

    async reject({ id }: TranslationCorrection, reason: RejectReason): Promise<CorrectionOutcome> {
        this.processing.add(id);
        try {
            if (await this.#client.rejectTranslationCorrection(id, reason)) {
                this.#remove(id);
                return { kind: "success" };
            }
            return {
                kind: "failed",
                message: i18nKey("Sorry we were unable to reject this correction"),
            };
        } finally {
            this.processing.delete(id);
        }
    }

    async verify(correction: TranslationCorrection): Promise<void> {
        this.verifying = { ...correction, value: TRANSLATING_PLACEHOLDER };
        const english = await this.#english(correction);
        this.verifying = { ...correction, value: english };
    }

    showProposed(): void {
        this.verifying = undefined;
    }

    #remove(id: bigint) {
        this.corrections = this.corrections.filter((c) => c.id !== id);
    }

    async #english(correction: TranslationCorrection): Promise<string> {
        const key = Number(correction.id);
        if (this.#verifications[key]) {
            return this.#verifications[key];
        }
        const english = await this.#client.translateText(correction.value, "en");
        if (english !== undefined) {
            this.#verifications[key] = english;
            return english;
        }
        return TRANSLATION_UNAVAILABLE;
    }
}

import { allUsersStore, type OpenChat, type ResourceKey, type UserSummary } from "@client";
import { i18nKey } from "@i18n/i18n";
import { SvelteSet } from "svelte/reactivity";

// The operator console's pending operator proposals (the old desktop's
// `home/admin/PendingOperatorProposals`, and the new UI's admin screen): the dual authorized
// actions one platform operator proposed, which take effect only when a different operator
// confirms them. Anyone may reject one.

export type PendingProposal = {
    id: number;
    summary: string;
    proposed_by: string;
    proposed_at: number;
    expires_at: number;
};

export type ProposalOutcome =
    | { kind: "success"; message: ResourceKey }
    | { kind: "failed"; message: ResourceKey };

type ProposalsClient = Pick<
    OpenChat,
    "protectedActions" | "confirmProtectedAction" | "cancelProtectedAction" | "getUser"
>;

const LOAD_FAILED = "Failed to load the pending proposals";

/** The register's pending list; none when it isn't JSON or has no list. */
export function parsePendingProposals(json: string): PendingProposal[] {
    try {
        return JSON.parse(json).pending ?? [];
    } catch {
        return [];
    }
}

// The canister rejects a confirmation from the proposer; the views disable it so the operator
// is told why rather than finding out through a failed call
export function isOwnProposal(proposal: PendingProposal, userId: string): boolean {
    return proposal.proposed_by === userId;
}

/** The proposers the user cache doesn't have, each once. */
export function unknownProposers(
    pending: PendingProposal[],
    isKnown: (userId: string) => boolean,
): string[] {
    return [...new Set(pending.map((p) => p.proposed_by).filter((id) => !isKnown(id)))];
}

/** "@username", or the user id while they're not loaded. */
export function proposerName(userId: string, user: UserSummary | undefined): string {
    return user === undefined ? userId : `@${user.username}`;
}

export function formatProposalTimestamp(ms: number): string {
    return new Date(ms).toLocaleString();
}

export class PendingProposals {
    pending = $state<PendingProposal[]>([]);
    loading = $state(true);
    error = $state<ResourceKey | undefined>(undefined);
    /** The proposals whose confirmation or rejection is under way. */
    readonly busy = new SvelteSet<number>();
    #client: ProposalsClient;

    constructor(client: ProposalsClient) {
        this.#client = client;
    }

    async refresh(): Promise<void> {
        this.loading = true;
        this.error = undefined;
        try {
            const json = await this.#client.protectedActions();
            if (json === undefined) {
                this.error = i18nKey(LOAD_FAILED);
                return;
            }
            this.pending = parsePendingProposals(json);
            this.#hydrateProposers();
        } catch {
            this.error = i18nKey(LOAD_FAILED);
        } finally {
            this.loading = false;
        }
    }

    async confirm(id: number): Promise<ProposalOutcome> {
        this.error = undefined;
        this.busy.add(id);
        try {
            const result = await this.#client.confirmProtectedAction(BigInt(id));
            let outcome: ProposalOutcome;
            if (result.kind === "success") {
                outcome = { kind: "success", message: i18nKey("Proposal confirmed and applied") };
            } else {
                // The confirmation is re-validated by the canister, which says WHY it was
                // refused (a legal hold now stands, the report is against your own message);
                // only fall back to guesswork when it says nothing
                this.error = i18nKey(
                    result.message ??
                        "Failed to confirm the proposal - it may have been superseded, cancelled or expired",
                );
                outcome = { kind: "failed", message: this.error };
            }
            void this.refresh();
            return outcome;
        } finally {
            this.busy.delete(id);
        }
    }

    async reject(id: number): Promise<ProposalOutcome> {
        this.error = undefined;
        this.busy.add(id);
        try {
            const result = await this.#client.cancelProtectedAction(BigInt(id));
            let outcome: ProposalOutcome;
            if (result.kind === "success") {
                outcome = { kind: "success", message: i18nKey("Proposal rejected") };
            } else {
                this.error = i18nKey(result.message ?? "Failed to reject the proposal");
                outcome = { kind: "failed", message: this.error };
            }
            void this.refresh();
            return outcome;
        } finally {
            this.busy.delete(id);
        }
    }

    // Operators are not necessarily in the local user cache (you may share no chats with
    // them), so pull in any proposer we do not already know. getUser populates the store,
    // which the views read reactively
    #hydrateProposers(): void {
        const users = allUsersStore.value;
        for (const userId of unknownProposers(this.pending, (id) => users.has(id))) {
            void this.#client.getUser(userId);
        }
    }
}

// All the state and logic for creating and editing a community, so that the components in both trees
// can be as purely presentational as possible. It returns outcomes; each tree shows them.

import { createCandidateCommunity } from "@src/stores/community";
import {
    anonUserStore,
    communitiesStore,
    communityChanges,
    defaultChatRules,
    isDiamondStore,
    OpenChat,
    type CommunityAndRules,
    type CommunityPermissions,
    type CommunitySummary,
    type CreateCommunityOutcome,
    type GroupChangeConfirmation,
    type UpdateCommunityOutcome,
    type UpdatedRules,
    type Rules,
} from "@client";
import { UpdateGroupOrCommunityState } from "./groupOrCommunity.svelte";

/**
 * How saving went. `declined` means the user declined to confirm a change, and `invalid` that the
 * community's details aren't valid, so nothing was sent.
 */
export type SaveCommunityOutcome =
    | UpdateCommunityOutcome
    | CreateCommunityOutcome
    | { kind: "declined" }
    | { kind: "invalid" };

export const MIN_NAME_LENGTH = 3;
export const MAX_NAME_LENGTH = 25;
export const MAX_DESC_LENGTH = 1024;

export class UpdateCommunityState extends UpdateGroupOrCommunityState {
    #channelNames = $state<string[]>([]);
    #candidateCommunity = $state<CommunitySummary>();
    #originalCommunity: CommunitySummary | undefined;
    #rules = $state<UpdatedRules>({ ...defaultChatRules("community"), newVersion: false });
    #originalRules: UpdatedRules = { ...defaultChatRules("community"), newVersion: false };
    #nameValid = $derived(
        this.#candidateCommunity !== undefined &&
            this.#candidateCommunity.name.length >= MIN_NAME_LENGTH &&
            this.#candidateCommunity.name.length <= MAX_NAME_LENGTH,
    );
    #valid = $derived(this.rulesValid && this.#nameValid);
    #editMode = $derived.by(() => {
        return this.#candidateCommunity?.id?.communityId !== "";
    });

    get candidate() {
        return this.candidateCommunity;
    }

    get original() {
        if (this.#originalCommunity === undefined) {
            throw new Error("Trying to access original community before it has been intiialised");
        }
        return this.#originalCommunity;
    }

    get rules() {
        return this.#rules;
    }

    set rules(val: UpdatedRules) {
        this.#rules = val;
    }

    get originalRules() {
        return this.#originalRules;
    }

    enableDefaultRules() {
        const newVersion = this.rules.newVersion;
        this.#rules = { ...defaultChatRules(this.candidate.level), newVersion, enabled: true };
    }

    initialise(community: CommunitySummary, rules: Rules) {
        this.reset();
        this.#channelNames = ["General"];
        // the candidate is mutated in place (via the $state proxy) so it must not share any
        // nested objects with the community held in the store
        this.#candidateCommunity = $state.snapshot(community);
        this.#rules = { ...rules, newVersion: false };
        this.#originalCommunity = $state.snapshot(this.candidateCommunity);
        this.#originalRules = $state.snapshot(this.#rules);
    }

    bannerSelected(detail: { url: string; data: Uint8Array }) {
        this.candidate.banner = {
            blobUrl: detail.url,
            blobData: detail.data,
        };
    }

    avatarSelected(detail: { url: string; data: Uint8Array }) {
        this.candidate.avatar = {
            blobUrl: detail.url,
            blobData: detail.data,
        };
    }

    get permissions(): CommunityPermissions {
        return this.candidate.permissions;
    }

    get channelNames(): string[] {
        return this.#channelNames;
    }

    set channelNames(val: string[]) {
        this.#channelNames = val;
    }

    get editMode(): boolean {
        return this.#editMode;
    }

    get nameValid() {
        return this.#nameValid;
    }

    get valid() {
        return this.#valid;
    }

    get candidateCommunity(): CommunitySummary {
        if (this.#candidateCommunity === undefined) {
            throw new Error("Trying to access candidate community before it has been set");
        }
        return this.#candidateCommunity;
    }

    set candidateCommunity(val: CommunitySummary) {
        this.#candidateCommunity = val;
    }

    deleteChannelName(channelName: string) {
        this.#channelNames = this.#channelNames.filter((n) => n !== channelName);
    }

    updateChannelName(from: string | undefined, to: string | undefined) {
        if (to === undefined) return;

        if (from === undefined) {
            this.#channelNames.push(to);
        } else {
            this.#channelNames = this.#channelNames.map((n) => (n === from ? to : n));
        }
    }

    isDuplicateChannelName(name: string): boolean {
        return (
            this.#channelNames.find((n) => n.toLocaleLowerCase() === name.toLocaleLowerCase()) !==
            undefined
        );
    }

    resetChannelNames() {
        this.#channelNames = ["General"];
    }

    /**
     * Creates the community or saves the changes to it. When the client asks for a change to be
     * confirmed, `confirming` or `showingVerificationWarning` is set, and the user's answer comes back
     * here as `yes`.
     */
    saveCommunity(client: OpenChat, yes: boolean = true): Promise<SaveCommunityOutcome> {
        // The mobile form submits on Enter even while its save button is disabled
        if (!this.valid) return Promise.resolve({ kind: "invalid" });
        if (this.#editMode) {
            return this.#updateCommunity(client, yes);
        } else {
            return this.#createCommunity(client);
        }
    }

    hasChanges(): boolean {
        const candidate = { community: this.candidateCommunity, rules: this.#rules };
        return Object.keys(communityChanges(this.#originalAndRules(), candidate)).length > 0;
    }

    protected declined(confirmation: GroupChangeConfirmation) {
        super.declined(confirmation);
        if (confirmation === "visibility") {
            this.candidateCommunity.public = this.original.public;
        }
    }

    #originalAndRules(): CommunityAndRules {
        return { community: this.original, rules: this.#originalRules };
    }

    #candidateAndRules(): CommunityAndRules {
        return {
            community: $state.snapshot(this.candidateCommunity),
            rules: $state.snapshot(this.#rules),
        };
    }

    async #updateCommunity(client: OpenChat, yes: boolean): Promise<SaveCommunityOutcome> {
        const candidate = this.#candidateAndRules();
        const outcome = await this.sendChanges(yes, (confirmed) =>
            client.updateCommunity(this.#originalAndRules(), candidate, confirmed),
        );
        if (outcome.kind === "success") {
            this.#originalCommunity = candidate.community;
            this.#originalRules = candidate.rules;
        }
        return outcome;
    }

    async #createCommunity(client: OpenChat): Promise<CreateCommunityOutcome> {
        this.busy = true;
        const outcome = await client.createCommunity(
            this.#candidateAndRules(),
            this.channelNames,
            this.candidateMembers.map(({ user }) => user.userId),
        );
        this.busy = false;
        return outcome;
    }

    // Starts a new community for the user to fill in
    initialiseNew() {
        this.initialise(newCommunity(), defaultChatRules("community"));
    }
}

// A new community, ordered after the user's others
export function newCommunity(): CommunitySummary {
    const maxIndex = communitiesStore.value.reduce(
        (m, [_, c]) => (c.membership.index > m ? c.membership.index : m),
        0,
    );
    return createCandidateCommunity("", maxIndex + 1);
}

/**
 * Whether the user can start creating a community. An anonymous user is sent to log in, and creates
 * the community after. Only Diamond members can create one.
 */
export function startCommunityCreation(client: OpenChat): "logging_in" | "needs_diamond" | "ready" {
    if (anonUserStore.value) {
        client.updateIdentityState({
            kind: "logging_in",
            postLogin: { kind: "create_community" },
        });
        return "logging_in";
    }
    return isDiamondStore.value ? "ready" : "needs_diamond";
}

export const updateCommunityState = new UpdateCommunityState();

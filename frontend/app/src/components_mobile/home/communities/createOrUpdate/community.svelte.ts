import { createCandidateCommunity } from "@src/stores/community";
import {
    anonUserStore,
    communitiesStore,
    defaultChatRules,
    isDiamondStore,
    OpenChat,
    publish,
    type CommunitySummary,
    type VersionedRules,
} from "openchat-client";
import { UpdateGroupOrCommunityState } from "../../groupOrCommunity.svelte";

export const MAX_RULES_LENGTH = 1024;
export const MIN_NAME_LENGTH = 3;
export const MAX_NAME_LENGTH = 25;
export const MAX_DESC_LENGTH = 1024;

class UpdateCommunityState extends UpdateGroupOrCommunityState {
    #candidateCommunity = $state<CommunitySummary>();
    #originalCommunity: CommunitySummary | undefined;
    #rules = $state<VersionedRules>(defaultChatRules("community"));
    #showingVerificationWarning = $state(false);
    #rulesValid = $derived(
        !this.#rules.enabled ||
            (this.#rules.text.length > 0 && this.#rules.text.length < MAX_RULES_LENGTH),
    );
    #nameValid = $derived(
        this.#candidateCommunity !== undefined &&
            this.#candidateCommunity.name.length >= MIN_NAME_LENGTH &&
            this.#candidateCommunity.name.length <= MAX_NAME_LENGTH,
    );
    #valid = $derived(this.#rulesValid && this.#nameValid);
    #editMode = $derived.by(() => {
        return this.#candidateCommunity?.id?.communityId !== "";
    });

    get candidate() {
        return this.candidateCommunity;
    }

    initialise(community: CommunitySummary, rules: VersionedRules) {
        this.reset();
        this.#candidateCommunity = community;
        this.#rules = rules;
        this.#originalCommunity = $state.snapshot(this.candidateCommunity);
        this.#showingVerificationWarning = false;
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

    get editMode(): boolean {
        return this.#editMode;
    }

    get nameValid() {
        return this.#nameValid;
    }

    get rulesValid() {
        return this.#rulesValid;
    }

    get valid() {
        return this.#valid;
    }

    get rules() {
        return this.#rules;
    }

    get showingVerificationWarning() {
        return this.#showingVerificationWarning;
    }

    get candidateCommunity(): CommunitySummary {
        if (this.#candidateCommunity === undefined) {
            throw new Error("Trying to access candidate community before it has been set");
        }
        return this.#candidateCommunity;
    }

    saveCommunity(_client: OpenChat, _yes: boolean = true): Promise<void> {
        console.log("TODO");
        return Promise.resolve();
    }

    createCommunity(client: OpenChat) {
        if (anonUserStore.value) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "create_community" },
            });
            return;
        }
        if (!isDiamondStore.value) {
            publish("upgrade");
        } else {
            const maxIndex = communitiesStore.value.reduce(
                (m, [_, c]) => (c.membership.index > m ? c.membership.index : m),
                0,
            );
            this.initialise(
                createCandidateCommunity("", maxIndex + 1),
                defaultChatRules("community"),
            );
            publish("updateCommunity");
        }
    }
}

export const updateCommunityState = new UpdateCommunityState();

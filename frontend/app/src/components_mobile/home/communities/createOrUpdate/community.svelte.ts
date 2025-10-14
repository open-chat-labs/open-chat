import { i18nKey } from "@src/i18n/i18n";
import { createCandidateCommunity } from "@src/stores/community";
import { toastStore } from "@src/stores/toast";
import {
    anonUserStore,
    communitiesStore,
    defaultChatRules,
    isDiamondStore,
    OpenChat,
    publish,
    type CommunitySummary,
    type UpdatedRules,
    type VersionedRules,
} from "openchat-client";
import page from "page";
import { UpdateGroupOrCommunityState } from "../../groupOrCommunity.svelte";

export const MAX_RULES_LENGTH = 1024;
export const MIN_NAME_LENGTH = 3;
export const MAX_NAME_LENGTH = 25;
export const MAX_DESC_LENGTH = 1024;

class UpdateCommunityState extends UpdateGroupOrCommunityState {
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

    get originalRules() {
        return this.#originalRules;
    }

    initialise(community: CommunitySummary, rules: VersionedRules) {
        this.reset();
        this.#candidateCommunity = community;
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

    get #visibilityChanged() {
        return this.original.public !== this.candidate.public;
    }

    get #nameChanged() {
        return this.original.name !== this.candidate.name;
    }

    get #descriptionChanged() {
        return this.original.description !== this.candidate.description;
    }

    get #avatarChanged() {
        return this.original.avatar?.blobUrl !== this.candidate.avatar?.blobUrl;
    }

    get #bannerChanged() {
        return this.original.banner?.blobUrl !== this.candidate.banner?.blobUrl;
    }

    get #languageChanged() {
        return this.original.primaryLanguage !== this.candidate.primaryLanguage;
    }

    saveCommunity(client: OpenChat, yes: boolean = true): Promise<void> {
        this.busy = true;
        if (this.#editMode) {
            const makePrivate =
                this.#visibilityChanged && !this.candidate.public && this.original?.public;

            const verificationWarning = this.#nameChanged && this.original?.verified;

            if (verificationWarning && !this.showingVerificationWarning) {
                this.showingVerificationWarning = true;
                return Promise.resolve();
            }

            if (makePrivate && !this.confirming) {
                this.confirming = true;
                return Promise.resolve();
            }

            if (verificationWarning && this.showingVerificationWarning && !yes) {
                this.showingVerificationWarning = false;
                this.busy = false;
                this.candidateCommunity.name = this.#originalCommunity?.name ?? "";
                return Promise.resolve();
            }

            if (makePrivate && this.confirming && !yes) {
                this.confirming = false;
                this.busy = false;
                this.candidateCommunity.public = true;
                return Promise.resolve();
            }

            this.confirming = false;
            this.showingVerificationWarning = false;

            const community = $state.snapshot(this.candidateCommunity);
            const communityRules = $state.snapshot(this.#rules);
            return client
                .saveCommunity(
                    community,
                    this.#nameChanged ? community.name : undefined,
                    this.#descriptionChanged ? community.description : undefined,
                    this.rulesChanged ? communityRules : undefined,
                    undefined, // todo - come back and sort out permissions
                    // permissionsDirty ? community.permissions : undefined,
                    this.#avatarChanged ? community.avatar.blobData : undefined,
                    this.#bannerChanged ? community.banner.blobData : undefined,
                    this.accessGatesChanged(client) ? community.gateConfig : undefined,
                    this.#visibilityChanged ? community.public : undefined,
                    this.#languageChanged ? community.primaryLanguage : undefined,
                )
                .then((success: boolean) => {
                    if (success) {
                        toastStore.showSuccessToast(i18nKey("communities.saved"));
                        publish("closeModalStack");
                    } else {
                        toastStore.showFailureToast(i18nKey("communities.errors.saveFailed"));
                    }
                })
                .finally(() => (this.busy = false));
        } else {
            const community = $state.snapshot(this.candidateCommunity);
            const communityRules = $state.snapshot(this.#rules);
            return client
                .createCommunity(
                    community,
                    communityRules,
                    ["General"], // todo - this should be a list of channel names but we don't have a design yet
                )
                .then((response) => {
                    if (response.kind === "success") {
                        toastStore.showSuccessToast(i18nKey("communities.created"));
                        page(`/community/${response.id}`);
                        this.#optionallyInviteUsers(client, response.id).catch((_err) => {
                            toastStore.showFailureToast(i18nKey("inviteUsersFailed"));
                        });
                        publish("closeModalStack");
                    } else {
                        console.log("CreateCommunity failed with", response);
                        toastStore.showFailureToast(i18nKey(`communities.errors.${response.kind}`));
                    }
                })
                .finally(() => (this.busy = false));
        }
    }

    #optionallyInviteUsers(client: OpenChat, communityId: string): Promise<void> {
        if (this.candidateMembers.length === 0) {
            return Promise.resolve();
        }
        return client
            .inviteUsers(
                { kind: "community", communityId },
                this.candidateMembers.map((m) => m.user.userId),
            )
            .then((resp) => {
                if (!resp) {
                    Promise.reject("Unable to invite users to the new community");
                }
            });
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
            publish("newCommunity");
        }
    }
}

export const updateCommunityState = new UpdateCommunityState();

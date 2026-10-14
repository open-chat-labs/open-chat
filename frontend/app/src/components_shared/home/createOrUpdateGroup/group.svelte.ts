// All the state and logic for creating and editing a group, so that the components in both trees can
// be as purely presentational as possible. It returns outcomes; each tree shows them.

import {
    defaultChatRules,
    groupChanges,
    OpenChat,
    type CandidateGroupChat,
    type ChatPermissions,
    type CreateGroupOutcome,
    type GroupChangeConfirmation,
    type UpdateGroupOutcome,
} from "@client";
import { UpdateGroupOrCommunityState } from "../groupOrCommunity.svelte";

/**
 * How saving went. `declined` means the user declined to confirm a change, and `invalid` that the
 * group's details aren't valid, so nothing was sent.
 */
export type SaveGroupOutcome =
    | UpdateGroupOutcome
    | CreateGroupOutcome
    | { kind: "declined" }
    | { kind: "invalid" };

export const MIN_NAME_LENGTH = 3;
export const MAX_NAME_LENGTH = 40;
export const MAX_DESC_LENGTH = 1024;

export class UpdateGroupState extends UpdateGroupOrCommunityState {
    #embedded = $state(false);
    #candidateGroup = $state<CandidateGroupChat>();
    #originalGroup: CandidateGroupChat | undefined;
    // The changes the user has confirmed while saving
    #confirmed: GroupChangeConfirmation[] = [];
    #nameValid = $derived(
        this.#candidateGroup !== undefined &&
            this.#candidateGroup.name.length >= MIN_NAME_LENGTH &&
            this.#candidateGroup.name.length <= MAX_NAME_LENGTH,
    );
    #urlValid = $derived.by(() => {
        if (this.candidateGroup.externalUrl === undefined) return true;
        try {
            new URL(this.candidateGroup.externalUrl);
        } catch (_) {
            return false;
        }
        return true;
    });
    #valid = $derived(this.rulesValid && this.#nameValid && this.#urlValid);
    #editMode = $derived.by(() => {
        if (this.#candidateGroup === undefined) return false;
        const id = this.#candidateGroup.id;
        switch (id.kind) {
            case "channel":
                return id.channelId !== 0;
            case "group_chat":
                return id.groupId !== "";
        }
    });
    #hideInviteUsers = $derived(
        this.#editMode ||
            (this.#candidateGroup?.level === "channel" && this.#candidateGroup?.public),
    );

    get candidate() {
        return this.candidateGroup;
    }

    get original() {
        if (this.#originalGroup === undefined) {
            throw new Error("Trying to access original group before it has been intiialised");
        }
        return this.#originalGroup;
    }

    get rules() {
        return this.candidate.rules;
    }

    get originalRules() {
        return this.original.rules;
    }

    get hideInviteUsers() {
        return this.#hideInviteUsers;
    }

    get embedded() {
        return this.#embedded;
    }

    enableDefaultRules() {
        const newVersion = this.rules.newVersion;
        this.candidate.rules = {
            ...defaultChatRules(this.candidate.level),
            newVersion,
            enabled: true,
        };
    }

    initialise(group: CandidateGroupChat | undefined) {
        this.reset();
        this.#candidateGroup = group;
        this.#embedded = group?.externalUrl !== undefined;
        this.#originalGroup = $state.snapshot(this.candidateGroup);
    }

    groupAvatarSelected(detail: { url: string; data: Uint8Array }) {
        this.candidateGroup.avatar = {
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

    get urlValid() {
        return this.#urlValid;
    }

    get valid() {
        return this.#valid;
    }

    get permissions(): ChatPermissions {
        return this.candidate.permissions;
    }

    get candidateGroup(): CandidateGroupChat {
        if (this.#candidateGroup === undefined) {
            throw new Error("Trying to access candidate group before it has been set");
        }
        return this.#candidateGroup;
    }

    set candidateGroup(val: CandidateGroupChat) {
        this.#candidateGroup = val;
    }

    /**
     * Creates the group or saves the changes to it. When the client asks for a change to be confirmed,
     * `confirming` or `showingVerificationWarning` is set, and the user's answer comes back here as
     * `yes`.
     */
    saveGroup(client: OpenChat, yes: boolean = true): Promise<SaveGroupOutcome> {
        // The mobile form submits on Enter even while its save button is disabled
        if (!this.valid) return Promise.resolve({ kind: "invalid" });
        if (this.editMode) {
            return this.#updateGroup(client, yes);
        } else {
            return this.#createGroup(client);
        }
    }

    hasChanges(): boolean {
        return Object.keys(groupChanges(this.original, this.candidate)).length > 0;
    }

    async #updateGroup(client: OpenChat, yes: boolean): Promise<SaveGroupOutcome> {
        const answering: GroupChangeConfirmation | undefined = this.showingVerificationWarning
            ? "verified_name"
            : this.confirming
              ? "visibility"
              : undefined;
        this.showingVerificationWarning = false;
        this.confirming = false;

        if (answering === undefined) {
            this.#confirmed = [];
        } else if (yes) {
            this.#confirmed.push(answering);
        } else {
            if (answering === "verified_name") {
                this.candidateGroup.name = this.original.name;
            }
            return { kind: "declined" };
        }

        this.busy = true;
        const updatedGroup = $state.snapshot(this.candidateGroup);
        const outcome = await client.updateGroup(this.original, updatedGroup, this.#confirmed);
        this.busy = false;

        if (outcome.kind === "needs_confirmation") {
            this.showingVerificationWarning = outcome.confirmation === "verified_name";
            this.confirming = outcome.confirmation === "visibility";
        } else if (outcome.kind === "success") {
            this.#originalGroup = updatedGroup;
        }
        return outcome;
    }

    async #createGroup(client: OpenChat): Promise<CreateGroupOutcome> {
        this.busy = true;
        const outcome = await client.createGroup(
            $state.snapshot(this.candidateGroup),
            this.hideInviteUsers ? [] : this.candidateMembers.map(({ user }) => user.userId),
        );
        this.busy = false;
        return outcome;
    }
}

export const updateGroupState = new UpdateGroupState();

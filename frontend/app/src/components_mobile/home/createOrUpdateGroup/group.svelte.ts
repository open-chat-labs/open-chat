// this is a class that holds all state and logic required for creating and editing groups
// so that the components themselves can be as purely presentational as possible
// We will use this in the new mobile components but there should be no reason that we cannot use this for the desktop components too in order to simplify them as well.

import { toastStore } from "@src/stores/toast";
import {
    chatListScopeStore,
    defaultChatRules,
    i18nKey,
    OpenChat,
    publish,
    routeForChatIdentifier,
    UnsupportedValueError,
    type CandidateGroupChat,
    type ChatPermissions,
    type Level,
    type MultiUserChatIdentifier,
    type ResourceKey,
    type UpdateGroupResponse,
} from "openchat-client";
import page from "page";
import { tick } from "svelte";
import { UpdateGroupOrCommunityState } from "../groupOrCommunity.svelte";

export const MIN_NAME_LENGTH = 3;
export const MAX_NAME_LENGTH = 40;
export const MAX_DESC_LENGTH = 1024;

export class UpdateGroupState extends UpdateGroupOrCommunityState {
    #candidateGroup = $state<CandidateGroupChat>();
    #originalGroup: CandidateGroupChat | undefined;
    #nameValid = $derived(
        this.#candidateGroup !== undefined &&
            this.#candidateGroup.name.length >= MIN_NAME_LENGTH &&
            this.#candidateGroup.name.length <= MAX_NAME_LENGTH,
    );
    #valid = $derived(this.rulesValid && this.#nameValid);
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

    saveGroup(client: OpenChat, yes: boolean = true): Promise<void> {
        if (this.editMode) {
            return this.#updateGroup(client, yes);
        } else {
            return this.#createGroup(client);
        }
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

    get #ttlChanged() {
        return this.original.eventsTTL !== this.candidate.eventsTTL;
    }

    get #visibleToNonMembersChanged() {
        return (
            this.original.messagesVisibleToNonMembers !== this.candidate.messagesVisibleToNonMembers
        );
    }

    get #externalUrlChanged() {
        return this.original.externalUrl !== this.candidate.externalUrl;
    }

    #updateGroup(client: OpenChat, yes: boolean = true): Promise<void> {
        if (this.#originalGroup === undefined || this.#candidateGroup === undefined)
            return Promise.resolve();

        this.busy = true;

        const changeVisibility = this.#visibilityChanged;
        const verificationWarning = this.#nameChanged && this.#originalGroup?.verified;

        if (verificationWarning && !this.showingVerificationWarning) {
            this.showingVerificationWarning = true;
            return Promise.resolve();
        }

        if (changeVisibility && !this.confirming) {
            this.confirming = true;
            return Promise.resolve();
        }

        if (verificationWarning && this.showingVerificationWarning && !yes) {
            this.showingVerificationWarning = false;
            this.busy = false;
            this.#candidateGroup.name = this.#originalGroup.name;
            return Promise.resolve();
        }

        if (changeVisibility && this.confirming && !yes) {
            this.confirming = false;
            this.busy = false;
            return Promise.resolve();
        }

        this.confirming = false;

        const updatedGroup = $state.snapshot(this.candidateGroup);
        const permissionsDirty = client.haveGroupPermissionsChanged(
            this.original.permissions,
            updatedGroup.permissions,
        );

        return client
            .updateGroup(
                updatedGroup.id,
                this.#nameChanged ? updatedGroup.name : undefined,
                this.#descriptionChanged ? updatedGroup.description : undefined,
                this.rulesChanged && this.rulesValid ? updatedGroup.rules : undefined,
                permissionsDirty
                    ? client.diffGroupPermissions(
                          this.original.permissions,
                          updatedGroup.permissions,
                      )
                    : undefined,
                this.#avatarChanged ? updatedGroup.avatar?.blobData : undefined,
                this.#ttlChanged
                    ? updatedGroup.eventsTTL === undefined
                        ? "set_to_none"
                        : { value: updatedGroup.eventsTTL }
                    : undefined,
                this.accessGatesChanged(client) ? updatedGroup.gateConfig : undefined,
                this.#visibilityChanged ? updatedGroup.public : undefined,
                this.#visibleToNonMembersChanged
                    ? updatedGroup.messagesVisibleToNonMembers
                    : undefined,
                this.#externalUrlChanged ? updatedGroup.externalUrl : undefined,
            )
            .then((resp) => {
                if (resp.kind === "success") {
                    this.#originalGroup = updatedGroup;
                } else {
                    const resourceKey = this.#groupUpdateErrorMessage(resp, updatedGroup.level);
                    if (resourceKey) {
                        toastStore.showFailureToast({
                            ...resourceKey,
                            level: updatedGroup.level,
                            lowercase: true,
                        });
                    }
                }
            })
            .finally(() => {
                this.busy = false;
                publish("closeModalStack");
            });
    }

    #createGroup(client: OpenChat): Promise<void> {
        this.busy = true;

        const level = this.candidateGroup.level;

        return client
            .createGroupChat($state.snapshot(this.candidateGroup))
            .then((resp) => {
                if (resp.kind !== "success") {
                    const resourceKey = client.groupCreationErrorMessage(resp, level);
                    if (resourceKey)
                        toastStore.showFailureToast({
                            ...resourceKey,
                            level,
                            lowercase: true,
                        });
                } else {
                    return this.#optionallyInviteUsers(client, resp.canisterId)
                        .catch((_err) => {
                            toastStore.showFailureToast(i18nKey("inviteUsersFailed"));
                        })
                        .then(() => {
                            this.#onGroupCreated(resp.canisterId);
                        });
                }
            })
            .catch((err) => {
                toastStore.showFailureToast(i18nKey("groupCreationFailed"));
                console.error("Error creating group: ", err);
            })
            .finally(() => (this.busy = false));
    }

    #groupUpdateErrorMessage(resp: UpdateGroupResponse, level: Level): ResourceKey | undefined {
        console.log("Group update response: ", resp);
        if (resp.kind === "success") return undefined;
        if (resp.kind === "unchanged") return undefined;
        if (resp.kind === "name_too_short") return i18nKey("groupNameTooShort");
        if (resp.kind === "name_too_long") return i18nKey("groupNameTooLong");
        if (resp.kind === "name_reserved") return i18nKey("groupNameReserved");
        if (resp.kind === "desc_too_long") return i18nKey("groupDescTooLong");
        if (resp.kind === "name_taken" && level === "group") return i18nKey("groupAlreadyExists");
        if (resp.kind === "name_taken") return i18nKey("channelAlreadyExists");
        if (resp.kind === "not_in_group") return i18nKey("userNotInGroup");
        if (resp.kind === "internal_error") return i18nKey("groupUpdateFailed");
        if (resp.kind === "not_authorized") return i18nKey("groupUpdateFailed");
        if (resp.kind === "avatar_too_big") return i18nKey("avatarTooBig");
        if (resp.kind === "rules_too_short") return i18nKey("groupRulesTooShort");
        if (resp.kind === "rules_too_long") return i18nKey("groupRulesTooLong");
        if (resp.kind === "user_suspended") return i18nKey("userSuspended");
        if (resp.kind === "user_lapsed") return i18nKey("userLapsed");
        if (resp.kind === "chat_frozen") return i18nKey("chatFrozen");
        if (resp.kind === "failure" || resp.kind === "error") return i18nKey("failure");
        if (resp.kind === "offline") return i18nKey("offlineError");
        if (resp.kind === "access_gate_invalid") return i18nKey("access.gateInvalid");
        throw new UnsupportedValueError(`Unexpected UpdateGroupResponse type received`, resp);
    }

    #onGroupCreated(canisterId: MultiUserChatIdentifier) {
        const url = routeForChatIdentifier(chatListScopeStore.value.kind, canisterId);
        publish("closeModalStack");
        tick().then(() => page(url)); // trigger the selection of the chat
    }

    #optionallyInviteUsers(client: OpenChat, chatId: MultiUserChatIdentifier): Promise<void> {
        if (this.candidateMembers.length === 0) {
            return Promise.resolve();
        }
        return client
            .inviteUsers(
                chatId,
                this.candidateMembers.map(({ user }) => user.userId),
            )
            .then((resp) => {
                if (!resp) {
                    Promise.reject("Unable to invite users to the new group");
                }
            });
    }
}

export const updateGroupState = new UpdateGroupState();

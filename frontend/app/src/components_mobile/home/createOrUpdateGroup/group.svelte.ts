// this is a class that holds all state and logic required for creating and editing groups
// so that the components themselves can be as purely presentational as possible

import { toastStore } from "@src/stores/toast";
import {
    chatListScopeStore,
    i18nKey,
    isCompositeGate,
    isLeafGate,
    OpenChat,
    publish,
    ROLE_MEMBER,
    routeForChatIdentifier,
    type CandidateGroupChat,
    type CandidateMember,
    type LeafGate,
    type MultiUserChatIdentifier,
    type UserOrUserGroup,
    type UserSummary,
} from "openchat-client";
import page from "page";
import { tick } from "svelte";

export const MAX_RULES_LENGTH = 1024;
export const MIN_NAME_LENGTH = 3;
export const MAX_NAME_LENGTH = 40;
export const MAX_DESC_LENGTH = 1024;

class UpdateGroupState {
    #candidateGroup = $state<CandidateGroupChat>();
    #candidateMembers = $state<CandidateMember[]>([]);
    #candidateUsers = $derived(this.#candidateMembers.map((m) => m.user));
    #accessGates = $derived.by<LeafGate[]>(() => {
        if (this.#candidateGroup === undefined) return [];
        if (this.#candidateGroup.gateConfig.gate.kind === "no_gate") return [];
        if (isLeafGate(this.#candidateGroup.gateConfig.gate))
            return [this.#candidateGroup.gateConfig.gate];
        if (isCompositeGate(this.#candidateGroup.gateConfig.gate))
            return this.#candidateGroup.gateConfig.gate.gates;
        return [];
    });
    #busy = $state(false);
    #rulesValid = $derived(
        this.#candidateGroup !== undefined &&
            (!this.#candidateGroup.rules.enabled ||
                (this.#candidateGroup.rules.text.length > 0 &&
                    this.#candidateGroup.rules.text.length < MAX_RULES_LENGTH)),
    );
    #nameValid = $derived(
        this.#candidateGroup !== undefined &&
            this.#candidateGroup.name.length >= MIN_NAME_LENGTH &&
            this.#candidateGroup.name.length <= MAX_NAME_LENGTH,
    );
    #valid = $derived(this.#rulesValid && this.#nameValid);

    initialise(group: CandidateGroupChat | undefined) {
        this.#candidateGroup = group;
        this.#candidateMembers = [];
    }

    groupAvatarSelected(detail: { url: string; data: Uint8Array }) {
        this.candidateGroup.avatar = {
            blobUrl: detail.url,
            blobData: detail.data,
        };
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

    get busy() {
        return this.#busy;
    }

    get candidateGroup(): CandidateGroupChat {
        if (this.#candidateGroup === undefined) {
            throw new Error("Trying to access candidate group before it has been set");
        }
        return this.#candidateGroup;
    }

    get accessGates() {
        return this.#accessGates;
    }

    get candidateMembers() {
        return this.#candidateMembers;
    }

    get candidateUsers() {
        return this.#candidateUsers;
    }

    deleteMember(user: UserOrUserGroup): void {
        if (user.kind !== "user") return;
        this.#candidateMembers = this.#candidateMembers.filter(
            (m) => m.user.userId !== user.userId,
        );
    }

    addMember(user: UserSummary): void {
        const u = this.#candidateMembers.find((m) => m.user.userId === user.userId);
        if (u === undefined) {
            this.#candidateMembers.push({ role: ROLE_MEMBER, user });
        }
    }

    createGroup(client: OpenChat) {
        this.#busy = true;

        const level = this.candidateGroup.level;

        client
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
            .finally(() => (this.#busy = false));
    }

    #onGroupCreated(canisterId: MultiUserChatIdentifier) {
        const url = routeForChatIdentifier(chatListScopeStore.value.kind, canisterId);
        publish("closeModalPage");
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

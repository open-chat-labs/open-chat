// this is a class that holds all state and logic required for creating and editing groups
// so that the components themselves can be as purely presentational as possible
// We will use this in the new mobile components but there should be no reason that we cannot use this for the desktop components too in order to simplify them as well.

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
    UnsupportedValueError,
    type AccessGate,
    type AccessGateConfig,
    type CandidateGroupChat,
    type CandidateMember,
    type ChitEarnedGate,
    type LeafGate,
    type Level,
    type MultiUserChatIdentifier,
    type NeuronGate,
    type PaymentGate,
    type ResourceKey,
    type TokenBalanceGate,
    type UpdateGroupResponse,
    type UserOrUserGroup,
    type UserSummary,
} from "openchat-client";
import page from "page";
import { tick } from "svelte";

export const MAX_RULES_LENGTH = 1024;
export const MIN_NAME_LENGTH = 3;
export const MAX_NAME_LENGTH = 40;
export const MAX_DESC_LENGTH = 1024;

function gatesByKind(config: AccessGateConfig, kind: AccessGate["kind"]): AccessGate[] {
    if (isLeafGate(config.gate)) {
        if (config.gate.kind === kind) {
            return [config.gate];
        }
    }
    if (isCompositeGate(config.gate)) {
        return config.gate.gates.filter((g) => g.kind === kind);
    }
    return [];
}

class UpdateGroupState {
    #candidateGroup = $state<CandidateGroupChat>();
    #originalGroup: CandidateGroupChat | undefined;
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
    #gateConfig = $derived<AccessGateConfig>(
        this.#candidateGroup?.gateConfig ?? { expiry: undefined, gate: { kind: "no_gate" } },
    );
    #neuronGates = $derived.by<NeuronGate[]>(() => {
        return gatesByKind(this.gateConfig, "neuron_gate") as NeuronGate[];
    });
    #paymentGates = $derived.by<PaymentGate[]>(() => {
        return gatesByKind(this.gateConfig, "payment_gate") as PaymentGate[];
    });
    #tokenBalanceGates = $derived.by<TokenBalanceGate[]>(() => {
        return gatesByKind(this.gateConfig, "token_balance_gate") as TokenBalanceGate[];
    });
    #busy = $state(false);
    #showingVerificationWarning = $state(false);
    #confirming = $state(false);
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

    initialise(group: CandidateGroupChat | undefined) {
        this.#candidateGroup = group;
        this.#originalGroup = $state.snapshot(this.candidateGroup);
        this.#candidateMembers = [];
        this.#showingVerificationWarning = false;
        this.#busy = false;
        this.#confirming = false;
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

    get neuronGates() {
        return this.#neuronGates;
    }

    get paymentGates() {
        return this.#paymentGates;
    }

    get tokenBalanceGates() {
        return this.#tokenBalanceGates;
    }

    get gateConfig() {
        return this.#gateConfig;
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

    get showingVerificationWarning() {
        return this.#showingVerificationWarning;
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

    saveGroup(client: OpenChat, yes: boolean = true): Promise<void> {
        if (this.editMode) {
            return this.#updateGroup(client, yes);
        } else {
            return this.#createGroup(client);
        }
    }

    #dirtyCheck(
        fn: (original: CandidateGroupChat, current: CandidateGroupChat) => boolean,
    ): boolean {
        if (this.#originalGroup === undefined || this.#candidateGroup === undefined) return false;
        return fn(this.#originalGroup, this.#candidateGroup);
    }

    get #visibilityChanged() {
        return this.#dirtyCheck((original, current) => original.public !== current.public);
    }

    get #nameChanged() {
        return this.#dirtyCheck((original, current) => original.name !== current.name);
    }

    get #descriptionChanged() {
        return this.#dirtyCheck(
            (original, current) => original.description !== current.description,
        );
    }

    get #rulesChanged() {
        return this.#dirtyCheck(
            (original, current) =>
                original.rules.enabled !== current.rules.enabled ||
                original.rules.text !== current.rules.text,
        );
    }

    get #avatarChanged() {
        return this.#dirtyCheck(
            (original, current) => original.avatar?.blobUrl !== current.avatar?.blobUrl,
        );
    }

    get #ttlChanged() {
        return this.#dirtyCheck((original, current) => original.eventsTTL !== current.eventsTTL);
    }

    get #visibleToNonMembersChanged() {
        return this.#dirtyCheck(
            (original, current) =>
                original.messagesVisibleToNonMembers !== current.messagesVisibleToNonMembers,
        );
    }

    get #externalUrlChanged() {
        return this.#dirtyCheck(
            (original, current) => original.externalUrl !== current.externalUrl,
        );
    }

    #accessGatesChanged(client: OpenChat) {
        return this.#dirtyCheck((original, current) =>
            client.hasAccessGateChanged(original.gateConfig, current.gateConfig),
        );
    }

    #updateGroup(client: OpenChat, yes: boolean = true): Promise<void> {
        if (this.#originalGroup === undefined || this.#candidateGroup === undefined)
            return Promise.resolve();

        this.#busy = true;

        const changeVisibility = this.#visibilityChanged;
        const verificationWarning = this.#nameChanged && this.#originalGroup?.verified;

        if (verificationWarning && !this.#showingVerificationWarning) {
            this.#showingVerificationWarning = true;
            return Promise.resolve();
        }

        if (changeVisibility && !this.#confirming) {
            this.#confirming = true;
            return Promise.resolve();
        }

        if (verificationWarning && this.#showingVerificationWarning && !yes) {
            this.#showingVerificationWarning = false;
            this.#busy = false;
            this.#candidateGroup.name = this.#originalGroup.name;
            return Promise.resolve();
        }

        if (changeVisibility && this.#confirming && !yes) {
            this.#confirming = false;
            this.#busy = false;
            return Promise.resolve();
        }

        this.#confirming = false;

        const updatedGroup = $state.snapshot(this.candidateGroup);

        return client
            .updateGroup(
                updatedGroup.id,
                this.#nameChanged ? updatedGroup.name : undefined,
                this.#descriptionChanged ? updatedGroup.description : undefined,
                this.#rulesChanged && this.rulesValid ? updatedGroup.rules : undefined,
                undefined, // todo - this where we plug in permissions
                // permissionsDirty
                //     ? client.diffGroupPermissions(
                //           originalGroup.permissions,
                //           updatedGroup.permissions,
                //       )
                //     : undefined,
                this.#avatarChanged ? updatedGroup.avatar?.blobData : undefined,
                this.#ttlChanged
                    ? updatedGroup.eventsTTL === undefined
                        ? "set_to_none"
                        : { value: updatedGroup.eventsTTL }
                    : undefined,
                this.#accessGatesChanged(client) ? updatedGroup.gateConfig : undefined,
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
                this.#busy = false;
                publish("closeModalStack");
            });
    }

    #createGroup(client: OpenChat): Promise<void> {
        this.#busy = true;

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
            .finally(() => (this.#busy = false));
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

    isGateActive(gate: AccessGate) {
        if (isLeafGate(this.#gateConfig.gate)) {
            return gate.kind === this.#gateConfig.gate.kind;
        }
        if (isCompositeGate(this.#gateConfig.gate)) {
            return this.#gateConfig.gate.gates.some((g) => g.kind === gate.kind);
        }
        return false;
    }

    addLeaf(newGate: LeafGate) {
        if (isCompositeGate(this.#gateConfig.gate)) {
            this.#gateConfig.gate.gates.push(newGate);
        } else {
            if (this.#gateConfig.gate.kind === "no_gate") {
                this.#gateConfig.gate = newGate;
            } else {
                const oldGate = { ...this.#gateConfig.gate };
                this.#gateConfig.gate = {
                    kind: "composite_gate",
                    gates: [oldGate, newGate],
                    operator: "and",
                };
            }
        }
    }

    deleteGate(gate: LeafGate) {
        if (isCompositeGate(this.#gateConfig.gate)) {
            this.#gateConfig.gate.gates = this.#gateConfig.gate.gates.filter(
                (g) => !this.gatesMatch(g, gate),
            );
            if (this.#gateConfig.gate.gates.length === 1) {
                this.#gateConfig.gate = this.#gateConfig.gate.gates[0];
            }
        } else {
            this.#gateConfig.gate = { kind: "no_gate" };
        }
    }

    #findMatchBy(fn: (g: LeafGate) => boolean) {
        if (isCompositeGate(this.#gateConfig.gate)) {
            return this.#gateConfig.gate.gates.find(fn);
        }

        if (isLeafGate(this.#gateConfig.gate) && fn(this.#gateConfig.gate)) {
            return this.#gateConfig.gate;
        }
    }

    findMatchByKind(kind: LeafGate["kind"]): LeafGate | undefined {
        return this.#findMatchBy((g) => g.kind === kind);
    }

    findMatch(gate: LeafGate): LeafGate | undefined {
        return this.#findMatchBy((g) => this.gatesMatch(g, gate));
    }

    gatesMatch(a: LeafGate, b: LeafGate): boolean {
        if (a.kind === "neuron_gate" && b.kind === "neuron_gate") {
            return a.governanceCanister === b.governanceCanister;
        }
        if (a.kind === "payment_gate" && b.kind === "payment_gate") {
            return a.ledgerCanister === b.ledgerCanister;
        }
        if (a.kind === "token_balance_gate" && b.kind === "token_balance_gate") {
            return a.ledgerCanister === b.ledgerCanister;
        }
        return a.kind === b.kind;
    }

    defaultChitGate(): ChitEarnedGate {
        return {
            kind: "chit_earned_gate",
            minEarned: 0,
        };
    }

    defaultTokenBalanceGate(): TokenBalanceGate {
        return {
            kind: "token_balance_gate",
            ledgerCanister: "",
            minBalance: 0n,
        };
    }

    defaultNeuronGate(): NeuronGate {
        return {
            kind: "neuron_gate",
            governanceCanister: "",
        };
    }

    defaultPaymentGate(): PaymentGate {
        return {
            kind: "payment_gate",
            ledgerCanister: "",
            amount: 0n,
            fee: 0n,
        };
    }

    toggleGate(gate: AccessGate, active: boolean) {
        if (isLeafGate(gate)) {
            if (active) {
                this.deleteGate(gate);
            } else {
                this.addLeaf(gate);
            }
        }
    }

    toggleOperator() {
        if (isCompositeGate(this.#gateConfig.gate)) {
            switch (this.#gateConfig.gate.operator) {
                case "and":
                    this.#gateConfig.gate.operator = "or";
                    break;
                case "or":
                    this.#gateConfig.gate.operator = "and";
                    break;
            }
        }
    }
}

export const updateGroupState = new UpdateGroupState();

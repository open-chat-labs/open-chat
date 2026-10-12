/**
 * This is going to encapsulate some shared logic and reactive state used for previewing and joining communities and groups
 */

import { i18nKey } from "@src/i18n/i18n";
import { toastStore } from "@src/stores/toast";
import type {
    CommunitySummary,
    EnhancedAccessGate,
    GateCheckSucceeded,
    MultiUserChat,
    OpenChat,
} from "@client";
import { anonUserStore, chatListScopeStore, type PaymentGateApprovals, publish, ROLE_NONE, routeForScope, selectedChatSummaryStore, selectedCommunitySummaryStore, stripSuspendedGate } from "@client";
import { navigate } from "@utils/navigation";

class ApprovalsAndCredentials {
    #credentials = $state<string[]>([]);
    #paymentApprovals = $state<PaymentGateApprovals>(new Map());
    #compositeGateIndex = $state<number | undefined>(undefined);

    get credentials() {
        return this.#credentials;
    }

    get paymentApprovals() {
        return this.#paymentApprovals;
    }

    get compositeGateIndex() {
        return this.#compositeGateIndex;
    }

    setCompositeGateIndex(index: number) {
        this.#compositeGateIndex = index;
    }

    reset() {
        this.#credentials = [];
        this.#paymentApprovals = new Map();
        this.#compositeGateIndex = undefined;
    }

    addCredential(cred: string) {
        this.#credentials.push(cred);
    }

    addPaymentApproval({
        ledger,
        amount,
        approvalFee,
    }: {
        ledger: string;
        amount: bigint;
        approvalFee: bigint;
    }) {
        const existing = this.#paymentApprovals.get(ledger);
        if (existing !== undefined) {
            // if we already have an approval pending for this ledger we add on the amount
            // but there will only be one fee
            existing.amount += amount;
            this.#paymentApprovals.set(ledger, existing);
        } else {
            this.#paymentApprovals.set(ledger, {
                amount,
                approvalFee,
            });
        }
    }

    balanceAfterCurrentCommitments(ledger: string, balance: bigint) {
        return balance - (this.#paymentApprovals.get(ledger)?.amount ?? 0n);
    }
}

class GroupPreview {
    #community = $state<CommunitySummary>();
    #chat = $state<MultiUserChat>();
    #joining = $state<MultiUserChat>();
    // the group being joined, held while its gates are evaluated
    #pending: MultiUserChat | undefined;
    #gateCheckFailed = $state<EnhancedAccessGate[]>([]);
    #gatesToEvaluate = $state<EnhancedAccessGate[]>([]);
    #previewingCommunity = $derived(
        this.#community?.membership.role === ROLE_NONE || this.#community?.membership.lapsed,
    );
    constructor() {
        selectedChatSummaryStore.subscribe((chat) => {
            if (chat === undefined || chat.kind === "direct_chat") {
                this.#chat = undefined;
            } else {
                this.#chat = chat;
            }
        });
        selectedCommunitySummaryStore.subscribe((community) => {
            this.#community = community;
        });
    }

    get joining() {
        return this.#joining;
    }

    get gateCheckFailed() {
        return this.#gateCheckFailed;
    }

    get gatesToEvaluate() {
        return this.#gatesToEvaluate;
    }

    reset() {
        this.#gatesToEvaluate = [];
        this.#gateCheckFailed = [];
    }

    cancelPreview(client: OpenChat) {
        if (this.#previewingCommunity && this.#community) {
            navigate(`/community/${this.#community.id.communityId}`);
        } else {
            if (this.#chat) {
                if (!this.#chat.public) {
                    client.declineInvitation(this.#chat.id);
                }
                client.removePreviewedChat(this.#chat.id);
                navigate(routeForScope(chatListScopeStore.value));
            }
        }
    }

    async joinGroup(client: OpenChat, group = this.#chat): Promise<void> {
        if (group === undefined) return;
        this.#pending = group;
        return this.#join(client, group);
    }

    /**
     * Carry on with the join that was waiting for its gates to be evaluated
     */
    doJoinGroup(client: OpenChat, gateCheck: GateCheckSucceeded): Promise<void> {
        if (this.#pending === undefined) return Promise.resolve();
        return this.#join(client, this.#pending, gateCheck);
    }

    async #join(client: OpenChat, group: MultiUserChat, gateCheck?: GateCheckSucceeded) {
        this.#joining = group;
        try {
            const outcome = await client.joinGroup(group, gateCheck);
            switch (outcome.kind) {
                case "needs_gate_evaluation":
                    accessApprovalState.reset();
                    this.#gatesToEvaluate = outcome.gates;
                    publish("evaluateGroupAccessGate");
                    break;
                case "gate_check_failed":
                    this.#gateCheckFailed = outcome.gates;
                    break;
                case "failed":
                    toastStore.showFailureToast(outcome.message);
                    break;
                case "success":
                case "skipped":
                    break;
                default:
                    outcome satisfies never;
            }
        } finally {
            this.#joining = undefined;
        }
    }
}

class CommunityPreview {
    #joining = $state(false);
    #gateCheckFailed = $state<EnhancedAccessGate>();
    #gatesToEvaluate = $state<EnhancedAccessGate>();
    #community = $state<CommunitySummary>();
    // Where cancelling the preview should return to, if the preview was entered
    // from somewhere other than the default scope (e.g. the community explorer)
    #origin: { communityId: string; path: string } | undefined = undefined;
    #gatesInEffect = $derived(
        this.#community !== undefined &&
            // Suspended (unique person) gates are stripped, so a lone unique person gate is no gate.
            stripSuspendedGate(this.#community.gateConfig.gate).kind !== "no_gate" &&
            !this.#community.isInvited,
    );
    #previewing = $derived(
        this.#community?.membership?.role === ROLE_NONE || this.#community?.membership?.lapsed,
    );

    constructor() {
        selectedCommunitySummaryStore.subscribe((community) => {
            this.#community = community;
        });
    }

    get joining() {
        return this.#joining;
    }

    get gatesToEvaluate() {
        return this.#gatesToEvaluate ? [this.#gatesToEvaluate] : [];
    }

    get gateCheckFailed() {
        return this.#gateCheckFailed;
    }

    get gatesInEffect() {
        return this.#gatesInEffect;
    }

    joinCommunity(client: OpenChat) {
        if (anonUserStore.value) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "join_community" },
            });
            return;
        }
        this.doJoinCommunity(client);
    }

    reset() {
        this.#gatesToEvaluate = undefined;
        this.#gateCheckFailed = undefined;
    }

    setOrigin(communityId: string, path: string) {
        this.#origin = { communityId, path };
    }

    doJoinCommunity(client: OpenChat, gateCheck?: GateCheckSucceeded): Promise<void> {
        if (this.#previewing && this.#community) {
            const credentials = gateCheck?.credentials ?? [];
            const paymentApprovals = gateCheck?.paymentApprovals ?? new Map();
            const compositeGateIndex = gateCheck?.compositeGateIndex;
            const gateConfigWithLevel: EnhancedAccessGate = {
                ...this.#community.gateConfig.gate,
                level: "community",
                collectionName: this.#community.name,
                expiry: this.#community.gateConfig.expiry,
            };

            if (gateCheck === undefined) {
                if (this.#gatesInEffect) {
                    const gateConfigs = [this.#community.gateConfig];
                    const gates = gateConfigs.map((gc) => gc.gate);
                    const passed = client.doesUserMeetAccessGates(gates);
                    if (!passed) {
                        /**
                         * If we cannot already tell that the user passes the access gate(s), check if there are any gates that require front end
                         * pre-processing.
                         */
                        if (client.gatePreprocessingRequired(gates)) {
                            this.#gatesToEvaluate = gateConfigWithLevel;
                            accessApprovalState.reset();
                            publish("evaluateCommunityAccessGate");
                            return Promise.resolve();
                        }
                    }
                }
            }

            this.reset();
            this.#joining = true;

            return client
                .joinCommunity(this.#community, credentials, paymentApprovals, compositeGateIndex)
                .then((resp) => {
                    if (resp.kind === "gate_check_failed") {
                        this.#gateCheckFailed = gateConfigWithLevel;
                    } else if (resp.kind !== "success") {
                        toastStore.showFailureToast(i18nKey("communities.errors.joinFailed"));
                    }
                })
                .finally(() => (this.#joining = false));
        }
        return Promise.resolve();
    }

    cancelPreview(client: OpenChat) {
        if (this.#previewing && this.#community) {
            const communityId = this.#community.id.communityId;
            const origin = this.#origin;
            this.#origin = undefined;
            client.removeCommunity(this.#community.id);
            navigate(
                origin?.communityId === communityId
                    ? origin.path
                    : routeForScope(client.getDefaultScope()),
            );
        }
    }
}

export const groupPreviewState = new GroupPreview();
export const communityPreviewState = new CommunityPreview();
export const accessApprovalState = new ApprovalsAndCredentials();

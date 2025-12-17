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
} from "openchat-client";
import {
    anonUserStore,
    chatListScopeStore,
    chatSummariesStore,
    type PaymentGateApprovals,
    publish,
    ROLE_NONE,
    routeForScope,
    selectedChatSummaryStore,
    selectedCommunitySummaryStore,
} from "openchat-client";
import page from "page";

class ApprovalsAndCredentials {
    #credentials = $state<string[]>([]);
    #paymentApprovals = $state<PaymentGateApprovals>(new Map());

    get credentials() {
        return this.#credentials;
    }

    get paymentApprovals() {
        return this.#paymentApprovals;
    }

    reset() {
        this.#credentials = [];
        this.#paymentApprovals = new Map();
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
            page(`/community/${this.#community.id.communityId}`);
        } else {
            if (this.#chat) {
                if (!this.#chat.public) {
                    client.declineInvitation(this.#chat.id);
                }
                client.removePreviewedChat(this.#chat.id);
                page(routeForScope(chatListScopeStore.value));
            }
        }
    }

    joinGroup(client: OpenChat) {
        if (this.#chat === undefined) return;

        if (anonUserStore.value) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: {
                    kind: "join_group",
                    group: this.#chat,
                    select: false,
                },
            });
            return;
        }

        // it's possible that we got here via a postLogin capture in which case it's possible
        // that we are actually already a member of this group, so we should double check here
        // that we actually *need* to join the group
        const chat = chatSummariesStore.value.get(this.#chat.id);
        if (chat === undefined || chat.membership.role === ROLE_NONE || client.isLapsed(chat.id)) {
            this.doJoinGroup(client);
        }
    }

    doJoinGroup(client: OpenChat, gateCheck?: GateCheckSucceeded): Promise<void> {
        if (this.#chat === undefined) return Promise.resolve();

        const group = this.#chat;
        this.#joining = this.#chat;
        const credentials = gateCheck?.credentials ?? [];
        const paymentApprovals = gateCheck?.paymentApprovals ?? new Map();

        if (gateCheck === undefined) {
            const gates = client.accessGatesForChat(group, true);
            const passed = client.doesUserMeetAccessGates(gates);

            if (!passed) {
                /**
                 * If we cannot already tell that the user passes the access gate(s), check if there are any gates that require front end
                 * pre-processing.
                 */
                if (client.gatePreprocessingRequired(gates)) {
                    accessApprovalState.reset();
                    this.#gatesToEvaluate = gates;
                    publish("evaluateGroupAccessGate");
                    return Promise.resolve();
                }
            }
        }

        return client
            .joinGroup(group, credentials, paymentApprovals)
            .then((resp) => {
                if (resp.kind === "blocked") {
                    toastStore.showFailureToast(i18nKey("youreBlocked"));
                } else if (resp.kind === "gate_check_failed") {
                    const gates = client.accessGatesForChat(group);
                    this.#gateCheckFailed = gates;
                } else if (resp.kind !== "success") {
                    toastStore.showFailureToast(
                        i18nKey("joinGroupFailed", undefined, group.level, true),
                    );
                }
            })
            .finally(() => (this.#joining = undefined));
    }
}

class CommunityPreview {
    #joining = $state(false);
    #gateCheckFailed = $state<EnhancedAccessGate>();
    #gatesToEvaluate = $state<EnhancedAccessGate>();
    #community = $state<CommunitySummary>();
    #gatesInEffect = $derived(
        this.#community !== undefined &&
            this.#community.gateConfig.gate.kind !== "no_gate" &&
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

    doJoinCommunity(client: OpenChat, gateCheck?: GateCheckSucceeded): Promise<void> {
        if (this.#previewing && this.#community) {
            const credentials = gateCheck?.credentials ?? [];
            const paymentApprovals = gateCheck?.paymentApprovals ?? new Map();
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
                .joinCommunity(this.#community, credentials, paymentApprovals)
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
            client.removeCommunity(this.#community.id);
            page("/communities");
        }
    }
}

export const groupPreviewState = new GroupPreview();
export const communityPreviewState = new CommunityPreview();
export const accessApprovalState = new ApprovalsAndCredentials();

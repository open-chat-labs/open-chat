// All the state and logic for making a proposal to an SNS, so that the components in both trees can be
// as purely presentational as possible. It returns outcomes; each tree shows them.

import {
    cryptoBalanceStore,
    currentUserIdStore,
    currentUserStore,
    executionPaymentAmount,
    formatTokens,
    proposalFundsRequired,
    routeForChatIdentifier,
    type CandidateProposalAction,
    type MakeProposalOutcome,
    type MultiUserChat,
    type NervousSystemDetails,
    type OpenChat,
    type ProposalExecutionPayment,
    type ResourceKey,
} from "@client";
import { isPrincipalValid, isUrl, random32, type ExternalBot } from "@shared";
import { i18nKey } from "@src/i18n/i18n";
import type { ProposalType } from "@src/utils/proposalTypes";
import { reactiveValue } from "@src/utils/reactiveValue";
import {
    createAddTokenPayload,
    createPublishExternalBotPayload,
    createRegisterExternalAchievementPayload,
    createUpdateTokenPayload,
} from "@src/utils/sns";

export const MIN_TITLE_LENGTH = 3;
export const MAX_TITLE_LENGTH = 120;
export const MAX_URL_LENGTH = 2000;
export const MIN_SUMMARY_LENGTH = 3;
export const MAX_SUMMARY_LENGTH = 10000;
export const MIN_ACHIEVEMENT_NAME_LENGTH = 3;
export const MAX_ACHIEVEMENT_NAME_LENGTH = 45;
export const MIN_CHIT_REWARD = 5000;
export const MIN_AWARDS = 200;
export const CANISTER_ID_LENGTH = 27;
const ONE_MONTH = 1000 * 60 * 60 * 24 * 30;

const balances = reactiveValue(cryptoBalanceStore);

/**
 * The step the form is at: `loading` while the balance is first checked, `deposit` while the user
 * can't afford the proposal, `details` for the title and summary, and `action` for the fields of the
 * proposal's type.
 */
export type ProposalStep = "loading" | "deposit" | "details" | "action";

// A form for a proposal type with fields of its own, which builds that type's action
export type ProposalSubForm = { convertAction(): CandidateProposalAction | undefined };

const VERIFICATION_TYPES: ProposalType[] = [
    "set_community_verification",
    "set_group_verification",
    "revoke_community_verification",
    "revoke_group_verification",
];

export class ProposalForm {
    #client: OpenChat;
    #chat: MultiUserChat;
    #nervousSystem: NervousSystemDetails;

    type = $state<ProposalType>();
    title = $state("");
    url = $state("");
    summary = $state("");
    achievementName = $state("");
    achievementUrl = $state("");
    achievementLogo = $state("");
    awardingAchievementCanisterId = $state("");
    chitRewardText = $state("5000");
    maxAwardsText = $state("200");
    achievementExpiry = $state(BigInt(ONE_MONTH));
    achievementExpiryValid = $state(true);
    tokenLedgerCanisterId = $state("");
    tokenInfoUrl = $state("");
    tokenTransactionUrlFormat = $state("");
    selectedBot = $state<ExternalBot>();
    // The form for the fields of the proposal's type, when it has its own, and whether it is valid
    subForm = $state.raw<ProposalSubForm>();
    subFormValid = $state(false);

    #step = $state<ProposalStep>("loading");
    #busy = $state(true);
    #refreshingBalance = $state(false);
    #balanceRefreshFailed = $state(false);
    #error = $state<ResourceKey>();

    #token = $derived.by(() => this.#nervousSystem.token);
    #balance = $derived.by(() => balances().get(this.#token.ledger) ?? 0n);
    #fundsRequired = $derived.by(() => proposalFundsRequired(this.#nervousSystem));
    #chitReward = $derived(Number(this.chitRewardText));
    #maxAwards = $derived(Number(this.maxAwardsText));
    #executionPayment = $derived.by<ProposalExecutionPayment | undefined>(() => {
        switch (this.type) {
            case "add_token":
                return { kind: "token_listing" };
            case "register_external_achievement":
                return {
                    kind: "achievement",
                    chitReward: this.#chitReward,
                    maxAwards: this.#maxAwards,
                };
        }
    });
    #insufficientFunds = $derived(this.#balance < this.#fundsRequired);
    #insufficientFundsForPayment = $derived.by(
        () =>
            this.#balance <
            this.#fundsRequired +
                executionPaymentAmount(this.#executionPayment, this.#token.transferFee),
    );
    #titleValid = $derived(
        this.title.length >= MIN_TITLE_LENGTH && this.title.length <= MAX_TITLE_LENGTH,
    );
    #urlValid = $derived(this.url.length <= MAX_URL_LENGTH);
    #summaryValid = $derived(
        this.summary.length >= MIN_SUMMARY_LENGTH && this.summary.length <= MAX_SUMMARY_LENGTH,
    );
    #achievementNameValid = $derived(
        this.achievementName.length >= MIN_ACHIEVEMENT_NAME_LENGTH &&
            this.achievementName.length <= MAX_ACHIEVEMENT_NAME_LENGTH,
    );
    #logoValid = $derived(this.achievementLogo.length === 0 || isUrl(this.achievementLogo));
    #actionValid = $derived.by(() => {
        switch (this.type) {
            case undefined:
                return false;
            case "motion":
            case "advance_sns_target_version":
                return true;
            case "publish_bot":
                return this.selectedBot !== undefined;
            case "remove_bot":
            case "transfer_sns_funds":
            case "set_community_verification":
            case "set_group_verification":
            case "revoke_community_verification":
            case "revoke_group_verification":
                return this.subFormValid;
            case "register_external_achievement":
                return (
                    this.#achievementNameValid &&
                    this.#chitReward >= MIN_CHIT_REWARD &&
                    this.#maxAwards >= MIN_AWARDS &&
                    this.achievementExpiryValid &&
                    this.#logoValid &&
                    this.achievementUrl.length > 0 &&
                    isPrincipalValid(this.awardingAchievementCanisterId)
                );
            case "add_token":
            case "update_token":
                return (
                    isPrincipalValid(this.tokenLedgerCanisterId) &&
                    this.tokenTransactionUrlFormat.length > 0
                );
        }
    });
    #valid = $derived(
        !this.#insufficientFunds &&
            !this.#insufficientFundsForPayment &&
            this.#titleValid &&
            this.#urlValid &&
            this.#summaryValid &&
            this.#actionValid,
    );
    // Motions and target version advances have no fields of their own, so are submitted from the
    // details step
    #canSubmit = $derived(
        this.#step === "action" ||
            (this.#step === "details" &&
                (this.type === "motion" || this.type === "advance_sns_target_version")),
    );

    constructor(client: OpenChat, chat: MultiUserChat, nervousSystem: NervousSystemDetails) {
        this.#client = client;
        this.#chat = chat;
        this.#nervousSystem = nervousSystem;
    }

    get step(): ProposalStep {
        return this.#step;
    }

    get busy(): boolean {
        return this.#busy;
    }

    get refreshingBalance(): boolean {
        return this.#refreshingBalance;
    }

    get error(): ResourceKey | undefined {
        return this.#error;
    }

    get balance(): bigint {
        return this.#balance;
    }

    get ledger(): string {
        return this.#token.ledger;
    }

    // Tells the user what making a proposal costs, or that the balance couldn't be checked
    get depositMessage(): ResourceKey {
        if (this.#balanceRefreshFailed)
            return i18nKey("unableToRefreshAccountBalance", { token: this.#token.symbol });
        const cost = formatTokens(this.#fundsRequired, this.#token.decimals);
        return i18nKey("proposal.maker.message", { cost, token: this.#token.symbol });
    }

    get depositError(): boolean {
        return this.#balanceRefreshFailed || this.#step === "loading" || this.#step === "deposit";
    }

    get valid(): boolean {
        return this.#valid;
    }

    get canSubmit(): boolean {
        return this.#canSubmit;
    }

    get titleValid(): boolean {
        return this.#titleValid;
    }

    get urlValid(): boolean {
        return this.#urlValid;
    }

    get summaryValid(): boolean {
        return this.#summaryValid;
    }

    get achievementNameValid(): boolean {
        return this.#achievementNameValid;
    }

    get logoValid(): boolean {
        return this.#logoValid;
    }

    get chitRewardValid(): boolean {
        return this.#chitReward >= MIN_CHIT_REWARD;
    }

    get maxAwardsValid(): boolean {
        return this.#maxAwards >= MIN_AWARDS;
    }

    // What the proposal's execution takes once it passes, on top of the fee for submitting it
    get executionPaymentAmount(): bigint {
        return executionPaymentAmount(this.#executionPayment, this.#token.transferFee);
    }

    get insufficientFundsForPayment(): boolean {
        return this.#insufficientFundsForPayment;
    }

    get canGoBack(): boolean {
        return this.#step === "action" || (this.#step === "details" && this.#insufficientFunds);
    }

    get isVerification(): boolean {
        return this.type !== undefined && VERIFICATION_TYPES.includes(this.type);
    }

    // The label and placeholder for the summary, which is the evidence or the reason for some types
    get summaryLabels(): [ResourceKey, ResourceKey] {
        if (this.isVerification) {
            return [i18nKey("verified.evidenceLabel"), i18nKey("verified.evidencePlaceholder")];
        }
        if (this.type === "remove_bot") {
            return [
                i18nKey("bots.manage.removeReason"),
                i18nKey("bots.manage.removeReasonPlaceholder"),
            ];
        }
        return [i18nKey("proposal.maker.summary"), i18nKey("proposal.maker.enterSummary")];
    }

    // The summary as it will appear on the proposal, with the line the ProposalsBot adds
    get summaryPreview(): string {
        const chatPath = routeForChatIdentifier(
            this.#chat.kind === "group_chat" ? "chats" : "community",
            this.#chat.id,
        );
        const userId = currentUserIdStore.value;
        return `${this.summary}

> Submitted by [@${currentUserStore.value.username}](https://oc.app/user/${userId}) on [OpenChat](https://oc.app${chatPath})`;
    }

    balanceRefreshStarted() {
        this.#refreshingBalance = true;
    }

    balanceRefreshed() {
        this.#refreshingBalance = false;
        this.#balanceRefreshFailed = false;
        if (this.#step === "loading") {
            this.#step = this.#insufficientFunds ? "deposit" : "details";
            this.#busy = false;
        } else if (this.#step === "deposit" && !this.#insufficientFunds) {
            this.#step = "details";
        }
    }

    balanceRefreshFailed() {
        this.#refreshingBalance = false;
        this.#balanceRefreshFailed = true;
    }

    // Moves on from the details to the fields of the proposal's type
    next() {
        if (this.#step === "details") this.#step = "action";
    }

    back() {
        if (this.#step === "action") {
            this.#step = "details";
        } else if (this.#step === "details" && this.#insufficientFunds) {
            this.#step = "deposit";
        }
    }

    /**
     * Makes the proposal. `invalid` means the form isn't complete, so nothing was sent; a failure's
     * message is also kept in `error`.
     */
    async submit(): Promise<MakeProposalOutcome | { kind: "invalid" }> {
        const action = this.#valid ? this.#action() : undefined;
        if (action === undefined) return { kind: "invalid" };

        this.#busy = true;
        this.#error = undefined;
        try {
            const outcome = await this.#client.makeProposal(
                this.#nervousSystem.governanceCanisterId,
                {
                    title: this.title,
                    url: this.url === "" ? undefined : this.url,
                    summary: this.summary,
                    action,
                },
                this.#executionPayment,
            );
            if (outcome.kind === "failed") this.#error = outcome.message;
            return outcome;
        } finally {
            this.#busy = false;
        }
    }

    #action(): CandidateProposalAction | undefined {
        switch (this.type) {
            case undefined:
                return undefined;
            case "motion":
            case "advance_sns_target_version":
                return { kind: this.type };
            case "transfer_sns_funds":
            case "remove_bot":
            case "set_community_verification":
            case "set_group_verification":
            case "revoke_community_verification":
            case "revoke_group_verification":
                return this.subForm?.convertAction();
            case "add_token":
                return {
                    kind: "execute_generic_nervous_system_function",
                    functionId: 7000n,
                    payload: createAddTokenPayload(
                        this.tokenLedgerCanisterId,
                        currentUserIdStore.value,
                        this.tokenInfoUrl,
                        this.tokenTransactionUrlFormat,
                        undefined,
                    ),
                };
            case "update_token":
                return {
                    kind: "execute_generic_nervous_system_function",
                    functionId: 7001n,
                    payload: createUpdateTokenPayload(
                        this.tokenLedgerCanisterId,
                        undefined,
                        undefined,
                        this.tokenInfoUrl,
                        this.tokenTransactionUrlFormat,
                        undefined,
                    ),
                };
            case "register_external_achievement":
                return {
                    kind: "execute_generic_nervous_system_function",
                    functionId: 1012n,
                    payload: createRegisterExternalAchievementPayload(
                        random32(),
                        currentUserIdStore.value,
                        this.achievementName,
                        this.achievementUrl,
                        this.achievementLogo,
                        this.awardingAchievementCanisterId,
                        this.#chitReward,
                        BigInt(Date.now()) + this.achievementExpiry,
                        this.#maxAwards,
                    ),
                };
            case "publish_bot":
                if (this.selectedBot === undefined) return undefined;
                return {
                    kind: "execute_generic_nervous_system_function",
                    functionId: 1015n,
                    payload: createPublishExternalBotPayload(this.selectedBot),
                };
        }
    }
}

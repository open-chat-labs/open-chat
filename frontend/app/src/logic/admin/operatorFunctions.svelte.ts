import {
    BRIDGE_PLATFORM_NAMES,
    MODERATION_CATEGORY_NAMES,
    isPrincipalValid,
    toRecord,
    toRecord2,
    type BridgePlatform,
    type DiamondMembershipFees,
    type ModerationConfig,
    type OCError,
    type OpenChat,
    type ProposedProtectedAction,
    type ResourceKey,
} from "@client";
import { i18nKey } from "@i18n/i18n";
import { SvelteSet } from "svelte/reactivity";

// The operator console's operator functions (the old desktop's `home/admin/OperatorFunctions`,
// and the new UI's admin screen): the platform settings an operator sets at once, and the
// "danger zone" of dual authorized ones, which only propose a change for a different operator
// to confirm under Pending proposals. Each action returns how it went for the view to toast; a
// failure some of them also keep (`error`) is shown under the form, as the old console did.

export type FeesToken = "CHAT" | "ICP";

/** A token's Diamond fees as typed: e8s, as text. */
export type FeesForm = {
    token: FeesToken;
    oneMonth: string;
    threeMonths: string;
    oneYear: string;
    lifetime: string;
};

/** Which action is under way: its button spins and is disabled. */
export type OperatorAction =
    | "groupUpgradeConcurrency"
    | "communityUpgradeConcurrency"
    | "diamondFees"
    | "stakeNeuron"
    | "tokenEnabled"
    | "openAiKey"
    | "moderationChannel"
    | "referralConfig"
    | "vaultReviewers"
    | "legalHold"
    | "destroyEvidence"
    | "mediaScan"
    | "authorityReporter"
    | "multiUserCanister"
    | "callPush"
    | "alchemyKey"
    // one for every platform's, as the old console had it
    | "bridgeBot"
    | "miniAppPrincipal";

export type OperatorOutcome =
    | { kind: "success"; message: ResourceKey }
    | { kind: "failed"; message: ResourceKey; err?: unknown };

type ReferralCategory = [bit: number, name: string];

// sexual/minors always takes the CSAM auto-sanction path so is not offered here
const CSAM_CATEGORY_BIT = 2;

/** The categories a referral threshold can be set for. */
export const REFERRAL_CATEGORIES: ReferralCategory[] = MODERATION_CATEGORY_NAMES.filter(
    ([bit]) => bit !== CSAM_CATEGORY_BIT,
);

export const BRIDGE_PLATFORMS = Object.keys(BRIDGE_PLATFORM_NAMES) as BridgePlatform[];

export function strToBigInt(str: string): bigint | undefined {
    const n = Number(str);
    return isNaN(n) ? undefined : BigInt(n);
}

/** A whole number, as a report index; anything else is none. */
export function parseReportIndex(value: string): bigint | undefined {
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) ? BigInt(trimmed) : undefined;
}

/** A comma separated list, each item trimmed, blanks dropped. */
export function parseIdList(text: string): string[] {
    return text
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id !== "");
}

// Empty threshold = category disabled; thresholds are per category because the right value
// differs between eg. sexual (catch the target content) and harassment (keep noise out of the
// queue)
export function referralThresholdsInvalid(thresholds: Record<number, string>): boolean {
    return Object.values(thresholds).some((t) => {
        if (t === "") return false;
        const threshold = Number(t);
        return isNaN(threshold) || threshold < 0 || threshold > 1;
    });
}

/** The categories with a threshold; none at all is referral disabled. */
export function referralConfig(
    thresholds: Record<number, string>,
): { categories: { category: number; scoreThreshold: number }[] } | undefined {
    const categories = Object.entries(thresholds)
        .filter(([_, t]) => t !== "")
        .map(([bit, t]) => ({ category: Number(bit), scoreThreshold: Number(t) }));
    return categories.length === 0 ? undefined : { categories };
}

export function feesForms(fees: DiamondMembershipFees[]): Record<FeesToken, FeesForm> {
    return toRecord2(
        fees,
        (f) => f.token,
        (f) => ({
            token: f.token,
            oneMonth: f.oneMonth.toString(),
            threeMonths: f.threeMonths.toString(),
            oneYear: f.oneYear.toString(),
            lifetime: f.lifetime.toString(),
        }),
    );
}

/**
 * The fees typed over the ones last set: a value that isn't a number keeps the last one. Writes
 * into `original` and returns it, as the old console did, so a failed attempt's values are the
 * ones a later bad value falls back to.
 */
export function mergeFees(
    current: Record<FeesToken, FeesForm>,
    original: Record<FeesToken, DiamondMembershipFees>,
): Record<FeesToken, DiamondMembershipFees> {
    return Object.values(current).reduce((res, val) => {
        res[val.token] = {
            token: val.token,
            oneMonth: strToBigInt(val.oneMonth) ?? res[val.token].oneMonth,
            threeMonths: strToBigInt(val.threeMonths) ?? res[val.token].threeMonths,
            oneYear: strToBigInt(val.oneYear) ?? res[val.token].oneYear,
            lifetime: strToBigInt(val.lifetime) ?? res[val.token].lifetime,
        };
        return res;
    }, original);
}

export type ModerationChannelInput =
    | { kind: "valid"; channel: { communityId: string; channelId: number } | undefined }
    | { kind: "invalid"; message: ResourceKey };

// Both blank is the deliberate "switch alerts off" case. Anything else must be a complete,
// well-formed pair: partial or malformed input previously fell through to `undefined`, silently
// proposing to unset the channel
export function moderationChannelInput(
    communityIdText: string,
    channelIdText: string,
): ModerationChannelInput {
    const communityId = communityIdText.trim();
    const channelId = channelIdText.trim();
    if (communityId === "" && channelId === "") {
        return { kind: "valid", channel: undefined };
    }
    if (communityId === "" || channelId === "") {
        return {
            kind: "invalid",
            message: i18nKey(
                "A community id and a channel id are both required (leave both blank to unset the channel)",
            ),
        };
    }
    if (!isPrincipalValid(communityId)) {
        return { kind: "invalid", message: i18nKey("That is not a valid community id") };
    }
    const channelIdNum = Number(channelId);
    if (!/^\d+$/.test(channelId) || !Number.isSafeInteger(channelIdNum)) {
        return { kind: "invalid", message: i18nKey("The channel id must be a whole number") };
    }
    return { kind: "valid", channel: { communityId, channelId: channelIdNum } };
}

/** "Enabled (a, b)", "Disabled (no scanners)" … */
export function mediaScanSummary(
    config: Pick<ModerationConfig, "mediaScanEnabled" | "mediaScanners">,
): string {
    return `${config.mediaScanEnabled ? "Enabled" : "Disabled"} (${
        config.mediaScanners.length === 0 ? "no scanners" : config.mediaScanners.join(", ")
    })`;
}

// The irreversible operator actions are dual authorized: proposing one only queues it, and a
// DIFFERENT operator must confirm before it executes.
export function proposalOutcome(
    proposed: ProposedProtectedAction | undefined,
    what: string,
): OperatorOutcome {
    if (proposed === undefined) {
        return { kind: "failed", message: i18nKey(`Failed to propose ${what}`) };
    }
    // Deliberately NOT worded as a success: nothing has taken effect yet, and the previous
    // wording read as though the change had been applied
    return {
        kind: "success",
        message: i18nKey(
            proposed.alreadyPending
                ? `An identical ${what} change is already pending as action #${proposed.actionId} - it still needs a different platform operator to confirm it`
                : `Proposed ${what} as action #${proposed.actionId} - NOT yet applied: a different platform operator must confirm it under Pending proposals`,
        ),
    };
}

/** An error response's message, else its code. */
export function errorDetail(resp: OCError): string {
    return resp.message ?? `code ${resp.code}`;
}

type OperatorClient = Pick<
    OpenChat,
    | "callPushEnabled"
    | "setCallPushEnabled"
    | "setAlchemyApiKey"
    | "setMiniAppServicePrincipal"
    | "setBridgeBot"
    | "moderationConfig"
    | "diamondMembershipFees"
    | "setGroupUpgradeConcurrency"
    | "setCommunityUpgradeConcurrency"
    | "createMultiUserCanister"
    | "setDiamondMembershipFees"
    | "stakeNeuronForSubmittingProposals"
    | "proposeSetOpenAIApiKey"
    | "setModerationReferralConfig"
    | "proposeSetMediaScanConfig"
    | "proposeSetAuthorityReporter"
    | "proposeSetVaultReviewers"
    | "setVaultLegalHold"
    | "proposeSetVaultLegalHold"
    | "proposeDestroyVaultEvidence"
    | "proposeSetInternalModerationChannel"
    | "setTokenEnabled"
>;

export class OperatorFunctions {
    error = $state<ResourceKey | undefined>(undefined);
    readonly busy = new SvelteSet<OperatorAction>();

    groupUpgradeConcurrency = $state("10");
    communityUpgradeConcurrency = $state("10");
    multiUserCanisterLocalUserIndex = $state("");
    governanceCanisterId = $state("");
    stake = $state("0");
    /** Each token's fees as typed; none until they're loaded. */
    currentFees = $state<Record<FeesToken, FeesForm> | undefined>(undefined);
    feesTab = $state<FeesToken>("ICP");
    tokenLedger = $state("");
    tokenEnabled = $state(true);
    openAiApiKey = $state("");
    alchemyApiKey = $state("");
    miniAppServicePrincipal = $state("");
    bridgeBotIds = $state<Record<BridgePlatform, string>>({
        discord: "",
        telegram: "",
        twitch: "",
    });
    moderationCommunityId = $state("");
    moderationChannelId = $state("");
    referralThresholds = $state<Record<number, string>>({});
    vaultReviewerIds = $state("");
    legalHoldReportIndex = $state("");
    legalHoldReference = $state("");
    destroyReportIndex = $state("");
    destroyRequestRef = $state("");
    openAiKeySet = $state(false);
    // The native call push kill switch (#9456): the toggle shows what the user index holds
    callPushEnabled = $state(false);
    mediaScanEnabled = $state(false);
    mediaScanScanners = $state("");
    authorityReporter = $state("");
    // Current values shown alongside the proposed ones, so an operator can see what a proposal
    // would actually change
    currentMediaScan = $state("");
    currentAuthorityReporter = $state("");
    currentVaultReviewers = $state("");
    currentModerationChannel = $state("");

    #originalFees: Record<FeesToken, DiamondMembershipFees> | undefined;
    #client: OperatorClient;

    constructor(client: OperatorClient) {
        this.#client = client;
    }

    get groupUpgradeConcurrencyInvalid(): boolean {
        return isNaN(parseInt(this.groupUpgradeConcurrency, 0));
    }

    get communityUpgradeConcurrencyInvalid(): boolean {
        return isNaN(parseInt(this.communityUpgradeConcurrency, 0));
    }

    get multiUserCanisterLocalUserIndexInvalid(): boolean {
        const id = this.multiUserCanisterLocalUserIndex.trim();
        return id === "" || !isPrincipalValid(id);
    }

    get tokenLedgerValid(): boolean {
        return this.tokenLedger.length > 0;
    }

    get referralThresholdsInvalid(): boolean {
        return referralThresholdsInvalid(this.referralThresholds);
    }

    referralThreshold(bit: number): string {
        return this.referralThresholds[bit] ?? "";
    }

    setReferralThreshold(bit: number, value: string): void {
        this.referralThresholds[bit] = value;
    }

    /** Reads what's set now: the call push switch, the moderation config and the fees. */
    load(): void {
        this.refreshCallPush();
        // Pre-fill the moderation config so the forms show what is actually set rather than
        // being write-only
        void this.#client.moderationConfig().then((config) => {
            if (config !== undefined) this.#prefill(config);
        });
        void this.#client.diamondMembershipFees().then((fees) => {
            this.#originalFees = toRecord(fees, (f) => f.token);
            this.currentFees = feesForms(fees);
        });
    }

    refreshCallPush(): void {
        this.#client
            .callPushEnabled()
            .then((enabled) => (this.callPushEnabled = enabled))
            .catch(() => undefined);
    }

    #prefill(config: ModerationConfig): void {
        this.openAiKeySet = config.openaiApiKeySet;
        if (config.internalModerationChannel !== undefined) {
            const { communityId, channelId } = config.internalModerationChannel;
            this.moderationCommunityId = communityId;
            this.moderationChannelId = channelId.toString();
            this.currentModerationChannel = `${communityId} / ${channelId}`;
        }
        if (config.referralConfig !== undefined) {
            this.referralThresholds = Object.fromEntries(
                config.referralConfig.categories.map((c) => [
                    c.category,
                    c.scoreThreshold.toString(),
                ]),
            );
        }
        this.vaultReviewerIds = config.vaultReviewers.join(", ");
        this.currentVaultReviewers = config.vaultReviewers.join(", ");
        this.mediaScanEnabled = config.mediaScanEnabled;
        this.mediaScanScanners = config.mediaScanners.join(", ");
        this.currentMediaScan = mediaScanSummary(config);
        this.authorityReporter = config.authorityReporter ?? "";
        this.currentAuthorityReporter = config.authorityReporter ?? "";
    }

    // Shown under the form as well as toasted
    #failed(message: ResourceKey): OperatorOutcome {
        this.error = message;
        return { kind: "failed", message };
    }

    async #busyWhile<T>(action: OperatorAction, run: () => Promise<T>): Promise<T> {
        this.busy.add(action);
        try {
            return await run();
        } finally {
            this.busy.delete(action);
        }
    }

    // Flips the switch on the user index, which fans it out to every local user index
    async applyCallPush(): Promise<OperatorOutcome> {
        const enabled = this.callPushEnabled;
        try {
            return await this.#busyWhile("callPush", async () => {
                try {
                    const resp = await this.#client.setCallPushEnabled(enabled);
                    return resp.kind === "success"
                        ? {
                              kind: "success",
                              message: i18nKey(
                                  `Native call push ${enabled ? "enabled" : "disabled"}`,
                              ),
                          }
                        : {
                              kind: "failed",
                              message: i18nKey(
                                  `Failed to update native call push: ${errorDetail(resp)}`,
                              ),
                          };
                } catch (err) {
                    return {
                        kind: "failed",
                        message: i18nKey("Failed to update native call push"),
                        err,
                    };
                }
            });
        } finally {
            this.refreshCallPush();
        }
    }

    // Sets the key on the user index, which passes it on to every MultiUser canister. Unsetting
    // it has its own button, so that a second click on Set can't unset it.
    setAlchemyApiKey(apiKey: string | undefined): Promise<OperatorOutcome> {
        return this.#busyWhile("alchemyKey", async () => {
            try {
                const resp = await this.#client.setAlchemyApiKey(apiKey);
                if (resp.kind === "success") {
                    this.alchemyApiKey = "";
                    return {
                        kind: "success",
                        message: i18nKey(
                            apiKey === undefined ? "Alchemy API key unset" : "Alchemy API key set",
                        ),
                    };
                }
                return {
                    kind: "failed",
                    message: i18nKey(`Failed to set the Alchemy API key: ${errorDetail(resp)}`),
                };
            } catch (err) {
                return {
                    kind: "failed",
                    message: i18nKey("Failed to set the Alchemy API key"),
                    err,
                };
            }
        });
    }

    // Sets the MiniApp service's principal on the user index, which passes it on to every
    // LocalUserIndex. Only that principal can post a MiniApp card or write to one
    async setMiniAppServicePrincipal(): Promise<OperatorOutcome> {
        this.error = undefined;
        const principal = this.miniAppServicePrincipal.trim();
        if (!isPrincipalValid(principal)) {
            return this.#failed(i18nKey(`"${principal}" is not a valid principal`));
        }
        return this.#busyWhile("miniAppPrincipal", async () => {
            try {
                const resp = await this.#client.setMiniAppServicePrincipal(principal);
                if (resp.kind === "success") {
                    this.miniAppServicePrincipal = "";
                    return { kind: "success", message: i18nKey("MiniApp service principal set") };
                }
                return {
                    kind: "failed",
                    message: i18nKey(
                        `Failed to set the MiniApp service principal: ${errorDetail(resp)}`,
                    ),
                };
            } catch (err) {
                return {
                    kind: "failed",
                    message: i18nKey("Failed to set the MiniApp service principal"),
                    err,
                };
            }
        });
    }

    // Sets the bot that bridges a platform, eg. Discord, on the user index, which passes it on
    // to every LocalUserIndex. Only that bot can relay messages from the platform
    setBridgeBot(platform: BridgePlatform, botId: string | undefined): Promise<OperatorOutcome> {
        const name = BRIDGE_PLATFORM_NAMES[platform];
        return this.#busyWhile("bridgeBot", async () => {
            try {
                const resp = await this.#client.setBridgeBot(platform, botId);
                if (resp.kind === "success") {
                    this.bridgeBotIds[platform] = "";
                    return {
                        kind: "success",
                        message: i18nKey(
                            botId === undefined
                                ? `${name} bridge bot unset`
                                : `${name} bridge bot set`,
                        ),
                    };
                }
                return {
                    kind: "failed",
                    message: i18nKey(`Failed to set the ${name} bridge bot: ${errorDetail(resp)}`),
                };
            } catch (err) {
                return {
                    kind: "failed",
                    message: i18nKey(`Failed to set the ${name} bridge bot`),
                    err,
                };
            }
        });
    }

    setGroupUpgradeConcurrency(): Promise<OperatorOutcome> {
        this.error = undefined;
        const value = this.groupUpgradeConcurrency;
        return this.#busyWhile("groupUpgradeConcurrency", async () =>
            (await this.#client.setGroupUpgradeConcurrency(parseInt(value, 0)))
                ? { kind: "success", message: i18nKey(`Group upgrade concurrency set to ${value}`) }
                : this.#failed(i18nKey(`Failed to set group upgrade concurrency to ${value}`)),
        );
    }

    setCommunityUpgradeConcurrency(): Promise<OperatorOutcome> {
        this.error = undefined;
        const value = this.communityUpgradeConcurrency;
        return this.#busyWhile("communityUpgradeConcurrency", async () =>
            (await this.#client.setCommunityUpgradeConcurrency(parseInt(value, 10)))
                ? {
                      kind: "success",
                      message: i18nKey(`Community upgrade concurrency set to ${value}`),
                  }
                : this.#failed(i18nKey(`Failed to set community upgrade concurrency to ${value}`)),
        );
    }

    createMultiUserCanister(): Promise<OperatorOutcome> {
        this.error = undefined;
        const localUserIndex = this.multiUserCanisterLocalUserIndex.trim();
        return this.#busyWhile("multiUserCanister", async () => {
            const resp = await this.#client.createMultiUserCanister(localUserIndex);
            if (resp.kind === "success") {
                return {
                    kind: "success",
                    message: i18nKey(`MultiUser canister created: ${resp.canisterId}`),
                };
            }
            return this.#failed(
                i18nKey(
                    resp.kind === "local_user_index_not_found"
                        ? `LocalUserIndex not found: ${localUserIndex}`
                        : `Failed to create MultiUser canister: ${resp.error ?? "unknown error"}`,
                ),
            );
        });
    }

    setDiamondMembershipFees(): Promise<OperatorOutcome> {
        this.error = undefined;
        let mappedFees: DiamondMembershipFees[] = [];
        if (this.currentFees !== undefined && this.#originalFees !== undefined) {
            this.#originalFees = mergeFees(this.currentFees, this.#originalFees);
            mappedFees = Object.values(this.#originalFees);
        }
        return this.#busyWhile("diamondFees", async () => {
            if (await this.#client.setDiamondMembershipFees(mappedFees)) {
                this.#originalFees = toRecord(mappedFees, (f) => f.token);
                return { kind: "success", message: i18nKey("Diamond membership fees set") };
            }
            return this.#failed(i18nKey("Failed to set diamond membership fees"));
        });
    }

    /** Nothing happens while the stake isn't a number. */
    async stakeNeuronForSubmittingProposals(): Promise<OperatorOutcome | undefined> {
        this.error = undefined;
        const stake = strToBigInt(this.stake);
        if (stake === undefined) return undefined;
        const governanceCanisterId = this.governanceCanisterId;
        return this.#busyWhile("stakeNeuron", async () =>
            (await this.#client.stakeNeuronForSubmittingProposals(governanceCanisterId, stake))
                ? { kind: "success", message: i18nKey("Neuron staked successfully") }
                : this.#failed(i18nKey("Failed to stake neuron")),
        );
    }

    proposeSetOpenAIApiKey(): Promise<OperatorOutcome> {
        this.error = undefined;
        const key = this.openAiApiKey;
        return this.#propose("openAiKey", "OpenAI API key", () =>
            this.#client.proposeSetOpenAIApiKey(key === "" ? undefined : key),
        );
    }

    setModerationReferralConfig(): Promise<OperatorOutcome> {
        this.error = undefined;
        const config = referralConfig(this.referralThresholds);
        return this.#busyWhile("referralConfig", async () =>
            (await this.#client.setModerationReferralConfig(config))
                ? {
                      kind: "success",
                      message: i18nKey(
                          config === undefined
                              ? "Moderation referral disabled"
                              : "Moderation referral config updated",
                      ),
                  }
                : this.#failed(i18nKey("Failed to update moderation referral config")),
        );
    }

    async proposeSetMediaScanConfig(): Promise<OperatorOutcome> {
        this.error = undefined;
        const scanners = parseIdList(this.mediaScanScanners);
        const invalid = scanners.find((id) => !isPrincipalValid(id));
        if (invalid !== undefined) {
            return this.#failed(i18nKey(`"${invalid}" is not a valid principal`));
        }
        const enabled = this.mediaScanEnabled;
        return this.#propose("mediaScan", "media scan config", () =>
            this.#client.proposeSetMediaScanConfig(enabled, scanners),
        );
    }

    // Registers (or clears) the off-chain NCA reporting service's principal
    async proposeSetAuthorityReporter(): Promise<OperatorOutcome> {
        this.error = undefined;
        const principal = this.authorityReporter.trim();
        if (principal !== "" && !isPrincipalValid(principal)) {
            return this.#failed(i18nKey(`"${principal}" is not a valid principal`));
        }
        return this.#propose("authorityReporter", "authority reporter", () =>
            this.#client.proposeSetAuthorityReporter(principal === "" ? undefined : principal),
        );
    }

    // Replaces the full reviewer set: user ids must already be platform moderators
    async proposeSetVaultReviewers(): Promise<OperatorOutcome> {
        this.error = undefined;
        const userIds = parseIdList(this.vaultReviewerIds);
        const invalid = userIds.find((id) => !isPrincipalValid(id));
        if (invalid !== undefined) {
            return this.#failed(i18nKey(`"${invalid}" is not a valid user id`));
        }
        return this.#propose("vaultReviewers", "vault reviewers", () =>
            this.#client.proposeSetVaultReviewers(userIds),
        );
    }

    // A preservation request stops the retention clock deleting the evidence; clearing the hold
    // performs any release which was deferred while it was set
    async setVaultLegalHold(legalHold: boolean): Promise<OperatorOutcome> {
        this.error = undefined;
        const reportIndex = parseReportIndex(this.legalHoldReportIndex);
        const reference = this.legalHoldReference.trim();
        if (reportIndex === undefined || reference === "") {
            return this.#failed(
                i18nKey("A report index and a request reference are both required"),
            );
        }
        return this.#busyWhile("legalHold", async () => {
            if (await this.#client.setVaultLegalHold(reportIndex, legalHold, reference)) {
                return {
                    kind: "success",
                    message: i18nKey(legalHold ? "Legal hold set" : "Legal hold cleared"),
                };
            }
            // Clearing a hold whose release is already pending performs that release, so the
            // canister refuses it here and it has to be proposed instead. The propose runs its
            // own validation, so a clear which failed for another reason (a bad report index,
            // say) surfaces that failure here rather than being swallowed
            if (!legalHold) {
                const proposed = await this.#client.proposeSetVaultLegalHold(
                    reportIndex,
                    false,
                    reference,
                );
                return this.#proposed(
                    proposed,
                    "clearing this legal hold (it would release the evidence)",
                );
            }
            return this.#failed(i18nKey("Failed to update the legal hold"));
        });
    }

    // Irreversible, so dual authorized: this only proposes the destruction. A DIFFERENT
    // platform operator must confirm it before anything is destroyed. A standing legal hold
    // blocks destruction outright - clear the hold first, as a separate act.
    async proposeDestroyVaultEvidence(): Promise<OperatorOutcome> {
        this.error = undefined;
        const reportIndex = parseReportIndex(this.destroyReportIndex);
        const reference = this.destroyRequestRef.trim();
        if (reportIndex === undefined || reference === "") {
            return this.#failed(
                i18nKey("A report index and a law enforcement reference are both required"),
            );
        }
        return this.#busyWhile("destroyEvidence", async () => {
            const proposed = await this.#client.proposeDestroyVaultEvidence(reportIndex, reference);
            if (proposed !== undefined) {
                this.destroyReportIndex = "";
                this.destroyRequestRef = "";
            }
            return this.#proposed(proposed, "destruction of vaulted evidence");
        });
    }

    async proposeSetInternalModerationChannel(): Promise<OperatorOutcome> {
        this.error = undefined;
        const input = moderationChannelInput(this.moderationCommunityId, this.moderationChannelId);
        if (input.kind === "invalid") {
            return this.#failed(input.message);
        }
        const channel = input.channel;
        return this.#propose(
            "moderationChannel",
            channel === undefined
                ? "unsetting the internal moderation channel"
                : "internal moderation channel",
            () => this.#client.proposeSetInternalModerationChannel(channel),
        );
    }

    setTokenEnabled(): Promise<OperatorOutcome> {
        this.error = undefined;
        const ledger = this.tokenLedger;
        const enabled = this.tokenEnabled;
        return this.#busyWhile("tokenEnabled", async () =>
            (await this.#client.setTokenEnabled(ledger, enabled))
                ? {
                      kind: "success",
                      message: i18nKey(`Token enabled set successfully: ${ledger}, ${enabled}`),
                  }
                : this.#failed(i18nKey(`Failed to set token enabled: ${ledger}, ${enabled}`)),
        );
    }

    #propose(
        action: OperatorAction,
        what: string,
        propose: () => Promise<ProposedProtectedAction | undefined>,
    ): Promise<OperatorOutcome> {
        return this.#busyWhile(action, async () => this.#proposed(await propose(), what));
    }

    #proposed(proposed: ProposedProtectedAction | undefined, what: string): OperatorOutcome {
        const outcome = proposalOutcome(proposed, what);
        return outcome.kind === "failed" ? this.#failed(outcome.message) : outcome;
    }
}

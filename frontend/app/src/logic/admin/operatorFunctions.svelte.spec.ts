import type { DiamondMembershipFees, OCError, Success } from "@client";
import { describe, expect, test, vi } from "vitest";
import {
    OperatorFunctions,
    REFERRAL_CATEGORIES,
    feesForms,
    mediaScanSummary,
    mergeFees,
    moderationChannelInput,
    parseIdList,
    parseReportIndex,
    proposalOutcome,
    referralConfig,
    referralThresholdsInvalid,
    strToBigInt,
} from "./operatorFunctions.svelte";

// a valid principal (the anonymous one)
const PRINCIPAL = "2vxsx-fae";

type OperatorClient = ConstructorParameters<typeof OperatorFunctions>[0];

const fees: DiamondMembershipFees[] = [
    { token: "ICP", oneMonth: 1n, threeMonths: 2n, oneYear: 3n, lifetime: 4n },
    { token: "CHAT", oneMonth: 10n, threeMonths: 20n, oneYear: 30n, lifetime: 40n },
];

function client(overrides: Partial<OperatorClient> = {}): OperatorClient {
    const ok = async (): Promise<Success | OCError> => ({ kind: "success" });
    return {
        callPushEnabled: async () => true,
        setCallPushEnabled: ok,
        setAlchemyApiKey: ok,
        setMiniAppServicePrincipal: ok,
        setBridgeBot: ok,
        moderationConfig: async () => undefined,
        diamondMembershipFees: async () => fees,
        setGroupUpgradeConcurrency: async () => true,
        setCommunityUpgradeConcurrency: async () => true,
        createMultiUserCanister: async () => ({ kind: "success", canisterId: "c" }),
        setDiamondMembershipFees: async () => true,
        stakeNeuronForSubmittingProposals: async () => true,
        proposeSetOpenAIApiKey: async () => ({ actionId: 1n, alreadyPending: false }),
        setModerationReferralConfig: async () => true,
        proposeSetMediaScanConfig: async () => ({ actionId: 2n, alreadyPending: false }),
        proposeSetAuthorityReporter: async () => ({ actionId: 3n, alreadyPending: false }),
        proposeSetVaultReviewers: async () => ({ actionId: 4n, alreadyPending: false }),
        setVaultLegalHold: async () => true,
        proposeSetVaultLegalHold: async () => ({ actionId: 5n, alreadyPending: false }),
        proposeDestroyVaultEvidence: async () => ({ actionId: 6n, alreadyPending: false }),
        proposeSetInternalModerationChannel: async () => ({ actionId: 7n, alreadyPending: false }),
        setTokenEnabled: async () => true,
        ...overrides,
    };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("parsing", () => {
    test("strToBigInt", () => {
        expect(strToBigInt("12")).toBe(12n);
        expect(strToBigInt("")).toBe(0n);
        expect(strToBigInt("abc")).toBeUndefined();
    });

    test("parseReportIndex takes whole numbers only", () => {
        expect(parseReportIndex(" 42 ")).toBe(42n);
        expect(parseReportIndex("4.2")).toBeUndefined();
        expect(parseReportIndex("")).toBeUndefined();
    });

    test("parseIdList", () => {
        expect(parseIdList(" a, b ,,c ")).toEqual(["a", "b", "c"]);
        expect(parseIdList("")).toEqual([]);
    });
});

describe("referral thresholds", () => {
    test("CSAM isn't offered", () => {
        expect(REFERRAL_CATEGORIES.some(([bit]) => bit === 2)).toBe(false);
        expect(REFERRAL_CATEGORIES.some(([bit]) => bit === 1)).toBe(true);
    });

    test("a threshold is blank or between 0 and 1", () => {
        expect(referralThresholdsInvalid({ 1: "", 4: "0.5", 8: "1" })).toBe(false);
        expect(referralThresholdsInvalid({ 1: "1.1" })).toBe(true);
        expect(referralThresholdsInvalid({ 1: "x" })).toBe(true);
        expect(referralThresholdsInvalid({ 1: "-0.1" })).toBe(true);
    });

    test("blank categories are left out, and none at all disables referral", () => {
        expect(referralConfig({ 1: "0.5", 4: "" })).toEqual({
            categories: [{ category: 1, scoreThreshold: 0.5 }],
        });
        expect(referralConfig({ 1: "" })).toBeUndefined();
    });
});

describe("fees", () => {
    test("a value that isn't a number keeps the last one", () => {
        const original = { ICP: fees[0], CHAT: fees[1] };
        const forms = feesForms(fees);
        forms.ICP.oneMonth = "100";
        forms.ICP.lifetime = "lots";
        const merged = mergeFees(forms, original);
        expect(merged.ICP).toEqual({
            token: "ICP",
            oneMonth: 100n,
            threeMonths: 2n,
            oneYear: 3n,
            lifetime: 4n,
        });
        expect(merged.CHAT).toEqual(fees[1]);
    });
});

describe("moderationChannelInput", () => {
    test("both blank unsets the channel", () => {
        expect(moderationChannelInput(" ", "")).toEqual({ kind: "valid", channel: undefined });
    });

    test("one without the other is refused", () => {
        expect(moderationChannelInput(PRINCIPAL, "").kind).toBe("invalid");
        expect(moderationChannelInput("", "12").kind).toBe("invalid");
    });

    test("the community id must be a principal, the channel id a whole number", () => {
        const bad = moderationChannelInput("nope", "12");
        expect(bad.kind === "invalid" && bad.message.key).toBe("That is not a valid community id");
        const fraction = moderationChannelInput(PRINCIPAL, "1.5");
        expect(fraction.kind === "invalid" && fraction.message.key).toBe(
            "The channel id must be a whole number",
        );
        expect(moderationChannelInput(` ${PRINCIPAL} `, " 12 ")).toEqual({
            kind: "valid",
            channel: { communityId: PRINCIPAL, channelId: 12 },
        });
    });
});

test("mediaScanSummary", () => {
    expect(mediaScanSummary({ mediaScanEnabled: false, mediaScanners: [] })).toBe(
        "Disabled (no scanners)",
    );
    expect(mediaScanSummary({ mediaScanEnabled: true, mediaScanners: ["a", "b"] })).toBe(
        "Enabled (a, b)",
    );
});

describe("proposalOutcome", () => {
    test("a proposal says it isn't applied yet", () => {
        const outcome = proposalOutcome({ actionId: 9n, alreadyPending: false }, "thing");
        expect(outcome.kind).toBe("success");
        expect(outcome.message.key).toBe(
            "Proposed thing as action #9 - NOT yet applied: a different platform operator must confirm it under Pending proposals",
        );
        expect(proposalOutcome({ actionId: 9n, alreadyPending: true }, "thing").message.key).toBe(
            "An identical thing change is already pending as action #9 - it still needs a different platform operator to confirm it",
        );
        expect(proposalOutcome(undefined, "thing")).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "Failed to propose thing" }),
        });
    });
});

describe("OperatorFunctions", () => {
    test("load fills the forms from what's set", async () => {
        const ops = new OperatorFunctions(
            client({
                moderationConfig: async () => ({
                    openaiApiKeySet: true,
                    internalModerationChannel: { communityId: PRINCIPAL, channelId: 5 },
                    referralConfig: { categories: [{ category: 1, scoreThreshold: 0.7 }] },
                    vaultReviewers: ["a", "b"],
                    mediaScanEnabled: true,
                    mediaScanners: ["s"],
                    authorityReporter: undefined,
                }),
            }),
        );
        ops.load();
        await settle();
        expect(ops.callPushEnabled).toBe(true);
        expect(ops.openAiKeySet).toBe(true);
        expect(ops.moderationChannelId).toBe("5");
        expect(ops.currentModerationChannel).toBe(`${PRINCIPAL} / 5`);
        expect(ops.referralThreshold(1)).toBe("0.7");
        expect(ops.referralThreshold(4)).toBe("");
        expect(ops.vaultReviewerIds).toBe("a, b");
        expect(ops.currentMediaScan).toBe("Enabled (s)");
        expect(ops.currentAuthorityReporter).toBe("");
        expect(ops.currentFees?.CHAT.lifetime).toBe("40");
    });

    test("an action is busy while it runs; its failure is shown under the form", async () => {
        const ops = new OperatorFunctions(
            client({ setGroupUpgradeConcurrency: async () => false }),
        );
        const pending = ops.setGroupUpgradeConcurrency();
        expect(ops.busy.has("groupUpgradeConcurrency")).toBe(true);
        const outcome = await pending;
        expect(ops.busy.has("groupUpgradeConcurrency")).toBe(false);
        expect(outcome.message.key).toBe("Failed to set group upgrade concurrency to 10");
        expect(ops.error?.key).toBe("Failed to set group upgrade concurrency to 10");
    });

    test("the call push switch's failure is toasted only, and the switch read back", async () => {
        const callPushEnabled = vi.fn(async () => false);
        const ops = new OperatorFunctions(
            client({
                callPushEnabled,
                setCallPushEnabled: async () => ({ kind: "error", code: 4, message: undefined }),
            }),
        );
        ops.callPushEnabled = true;
        const outcome = await ops.applyCallPush();
        expect(outcome.message.key).toBe("Failed to update native call push: code 4");
        expect(ops.error).toBeUndefined();
        await settle();
        expect(callPushEnabled).toHaveBeenCalled();
        expect(ops.callPushEnabled).toBe(false);
    });

    test("an invalid principal isn't sent", async () => {
        const setPrincipal = vi.fn();
        const ops = new OperatorFunctions(client({ setMiniAppServicePrincipal: setPrincipal }));
        ops.miniAppServicePrincipal = " nope ";
        const outcome = await ops.setMiniAppServicePrincipal();
        expect(outcome.message.key).toBe('"nope" is not a valid principal');
        expect(setPrincipal).not.toHaveBeenCalled();
    });

    test("a bridge bot set clears its field", async () => {
        const setBridgeBot = vi.fn(async (): Promise<Success | OCError> => ({ kind: "success" }));
        const ops = new OperatorFunctions(client({ setBridgeBot }));
        ops.bridgeBotIds.discord = "bot";
        const outcome = await ops.setBridgeBot("discord", "bot");
        expect(setBridgeBot).toHaveBeenCalledWith("discord", "bot");
        expect(outcome.message.key).toBe("Discord bridge bot set");
        expect(ops.bridgeBotIds.discord).toBe("");
    });

    test("clearing a legal hold the canister refuses proposes it instead", async () => {
        const propose = vi.fn(async () => ({ actionId: 8n, alreadyPending: false }));
        const ops = new OperatorFunctions(
            client({ setVaultLegalHold: async () => false, proposeSetVaultLegalHold: propose }),
        );
        ops.legalHoldReportIndex = "3";
        ops.legalHoldReference = " ref ";
        const outcome = await ops.setVaultLegalHold(false);
        expect(propose).toHaveBeenCalledWith(3n, false, "ref");
        expect(outcome.kind).toBe("success");
        expect(outcome.message.key).toContain("Proposed clearing this legal hold");

        const setting = await ops.setVaultLegalHold(true);
        expect(setting.message.key).toBe("Failed to update the legal hold");
    });

    test("a legal hold needs a report index and a reference", async () => {
        const ops = new OperatorFunctions(client());
        ops.legalHoldReportIndex = "x";
        ops.legalHoldReference = "ref";
        const outcome = await ops.setVaultLegalHold(true);
        expect(outcome.message.key).toBe(
            "A report index and a request reference are both required",
        );
    });

    test("a destruction proposed clears its form", async () => {
        const ops = new OperatorFunctions(client());
        ops.destroyReportIndex = "4";
        ops.destroyRequestRef = "LE-1";
        const outcome = await ops.proposeDestroyVaultEvidence();
        expect(outcome.kind).toBe("success");
        expect(ops.destroyReportIndex).toBe("");
        expect(ops.destroyRequestRef).toBe("");
    });

    test("vault reviewers must be principals", async () => {
        const propose = vi.fn();
        const ops = new OperatorFunctions(client({ proposeSetVaultReviewers: propose }));
        ops.vaultReviewerIds = `${PRINCIPAL}, bad`;
        const outcome = await ops.proposeSetVaultReviewers();
        expect(outcome.message.key).toBe('"bad" is not a valid user id');
        expect(propose).not.toHaveBeenCalled();
    });

    test("a blank OpenAI key proposes unsetting it", async () => {
        const propose = vi.fn(async () => ({ actionId: 1n, alreadyPending: false }));
        const ops = new OperatorFunctions(client({ proposeSetOpenAIApiKey: propose }));
        await ops.proposeSetOpenAIApiKey();
        expect(propose).toHaveBeenCalledWith(undefined);
    });

    test("fees typed are sent over the ones loaded", async () => {
        const setFees = vi.fn(async () => true);
        const ops = new OperatorFunctions(client({ setDiamondMembershipFees: setFees }));
        ops.load();
        await settle();
        ops.currentFees!.ICP.oneMonth = "7";
        const outcome = await ops.setDiamondMembershipFees();
        expect(outcome.message.key).toBe("Diamond membership fees set");
        expect(setFees).toHaveBeenCalledWith([{ ...fees[0], oneMonth: 7n }, fees[1]]);
    });

    test("staking does nothing while the stake isn't a number", async () => {
        const stake = vi.fn(async () => true);
        const ops = new OperatorFunctions(client({ stakeNeuronForSubmittingProposals: stake }));
        ops.stake = "lots";
        expect(await ops.stakeNeuronForSubmittingProposals()).toBeUndefined();
        expect(stake).not.toHaveBeenCalled();
    });

    test("validity of the fields", () => {
        const ops = new OperatorFunctions(client());
        expect(ops.groupUpgradeConcurrencyInvalid).toBe(false);
        ops.groupUpgradeConcurrency = "x";
        expect(ops.groupUpgradeConcurrencyInvalid).toBe(true);
        expect(ops.multiUserCanisterLocalUserIndexInvalid).toBe(true);
        ops.multiUserCanisterLocalUserIndex = PRINCIPAL;
        expect(ops.multiUserCanisterLocalUserIndexInvalid).toBe(false);
        expect(ops.tokenLedgerValid).toBe(false);
        ops.setReferralThreshold(1, "2");
        expect(ops.referralThresholdsInvalid).toBe(true);
    });
});

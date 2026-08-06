<script lang="ts">
    import {
        MODERATION_CATEGORY_NAMES,
        type DiamondMembershipFees,
        type OpenChat,
        type ResourceKey,
        type UpdateMarketMakerConfigArgs,
    } from "@client";
    import { getContext, onMount } from "svelte";
    import type { ProposedProtectedAction } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Input from "../../Input.svelte";
    import Select from "../../Select.svelte";
    import Toggle from "../../Toggle.svelte";
    import Translatable from "../../Translatable.svelte";

    type Fees = {
        token: "CHAT" | "ICP";
        oneMonth: string;
        threeMonths: string;
        oneYear: string;
        lifetime: string;
    };

    const client = getContext<OpenChat>("client");

    let error: ResourceKey | undefined = $state(undefined);
    let groupUpgradeConcurrency = $state("10");
    let communityUpgradeConcurrency = $state("10");
    let userUpgradeConcurrency = $state("10");
    let busy: Set<number> = $state(new Set());
    let governanceCanisterId = $state("");
    let stake = $state("0");

    let exchangeId: string = $state("");
    let enabled: boolean = $state(true);
    let priceIncrement: string = $state("");
    let orderSize: string = $state("");
    let minOrderSize: string = $state("");
    let maxBuyPrice: string = $state("");
    let minSellPrice: string = $state("");
    let spread: string = $state("");
    let minOrdersPerDirection: string = $state("");
    let maxOrdersPerDirection: string = $state("");
    let maxOrdersToMakePerIteration: string = $state("");
    let maxOrdersToCancelPerIteration: string = $state("");
    let currentFees: Record<"ICP" | "CHAT", Fees> | undefined = $state();
    let originalFees: Record<"ICP" | "CHAT", DiamondMembershipFees>;
    let feesTab: "ICP" | "CHAT" = $state("ICP");
    let tokenLedger = $state("");
    let tokenEnabled = $state(true);
    let openAiApiKey = $state("");
    let moderationCommunityId = $state("");
    let moderationChannelId = $state("");
    // sexual/minors always takes the CSAM auto-sanction path so is not offered here.
    // Empty threshold = category disabled; thresholds are per category because the right
    // value differs between eg. sexual (catch the target content) and harassment (keep
    // noise out of the queue)
    let referralThresholds: Record<number, string> = $state({});
    let vaultReviewerIds = $state("");
    let legalHoldReportIndex = $state("");
    let legalHoldReference = $state("");
    let destroyReportIndex = $state("");
    let destroyRequestRef = $state("");
    let destroyConfirmed = $state(false);

    const CSAM_CATEGORY_BIT = 2;
    let referralThresholdsInvalid = $derived.by(() => {
        return Object.values(referralThresholds).some((t) => {
            if (t === "") return false;
            const threshold = Number(t);
            return isNaN(threshold) || threshold < 0 || threshold > 1;
        });
    });
    let groupUpgradeConcurrencyInvalid = $derived(isNaN(parseInt(groupUpgradeConcurrency, 0)));
    let communityUpgradeConcurrencyInvalid = $derived(
        isNaN(parseInt(communityUpgradeConcurrency, 0)),
    );
    let userUpgradeConcurrencyInvalid = $derived(isNaN(parseInt(userUpgradeConcurrency, 0)));
    let exchangeIdInvalid = $derived(isNaN(parseInt(exchangeId, 0)));
    let tokenLedgerValid = $derived(tokenLedger.length > 0);

    let openAiKeySet = $state(false);
    type PendingProtectedAction = {
        id: number;
        summary: string;
        proposed_by: string;
        proposed_at: number;
        expires_at: number;
    };
    let pendingActions: PendingProtectedAction[] = $state([]);

    function refreshPendingActions(): void {
        client.protectedActions().then((json) => {
            if (json === undefined) return;
            try {
                pendingActions = JSON.parse(json).pending ?? [];
            } catch {
                pendingActions = [];
            }
        });
    }

    // The four irreversible operator actions are dual authorized: proposing one only queues
    // it, and a DIFFERENT operator must confirm before it executes.
    function onProposed(proposed: ProposedProtectedAction | undefined, what: string): void {
        if (proposed === undefined) {
            error = i18nKey(`Failed to propose ${what}`);
            toastStore.showFailureToast(error);
            return;
        }
        // Deliberately NOT a success toast: nothing has taken effect yet, and the previous
        // wording read as though the change had been applied
        toastStore.showSuccessToast(
            i18nKey(
                proposed.alreadyPending
                    ? `An identical ${what} change is already pending as action #${proposed.actionId} - it still needs a different platform operator to confirm it`
                    : `Proposed ${what} as action #${proposed.actionId} - NOT yet applied: a different platform operator must confirm it below`,
            ),
        );
        refreshPendingActions();
    }

    function confirmProtectedAction(actionId: number): void {
        error = undefined;
        addBusy(13);
        client
            .confirmProtectedAction(BigInt(actionId))
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey("Action confirmed and executed"));
                } else {
                    error = i18nKey(
                        "Failed to confirm the action (a proposal cannot be confirmed by its proposer)",
                    );
                    toastStore.showFailureToast(error);
                }
                refreshPendingActions();
            })
            .finally(() => removeBusy(13));
    }

    function cancelProtectedAction(actionId: number): void {
        error = undefined;
        addBusy(14);
        client
            .cancelProtectedAction(BigInt(actionId))
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey("Action cancelled"));
                } else {
                    error = i18nKey("Failed to cancel the action");
                    toastStore.showFailureToast(error);
                }
                refreshPendingActions();
            })
            .finally(() => removeBusy(14));
    }

    onMount(() => {
        refreshPendingActions();
        // Pre-fill the moderation config so the forms show what is actually set rather than
        // being write-only
        client.moderationConfig().then((config) => {
            if (config === undefined) return;
            openAiKeySet = config.openaiApiKeySet;
            if (config.internalModerationChannel !== undefined) {
                moderationCommunityId = config.internalModerationChannel.communityId;
                moderationChannelId = config.internalModerationChannel.channelId.toString();
            }
            if (config.referralConfig !== undefined) {
                referralThresholds = Object.fromEntries(
                    config.referralConfig.categories.map((c) => [
                        c.category,
                        c.scoreThreshold.toString(),
                    ]),
                );
            }
            vaultReviewerIds = config.vaultReviewers.join(", ");
        });
        client.diamondMembershipFees().then((fees) => {
            originalFees = client.toRecord(fees, (f) => f.token);
            currentFees = client.toRecord2(
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
        });
    });

    function buildMarketMakerConfig(): UpdateMarketMakerConfigArgs | undefined {
        let config;
        if (exchangeIdInvalid) return undefined;

        try {
            config = {
                exchangeId: parseInt(exchangeId, 0),
                enabled: enabled,
                priceIncrement: priceIncrement === "" ? undefined : BigInt(priceIncrement),
                orderSize: orderSize === "" ? undefined : BigInt(orderSize),
                minOrderSize: minOrderSize === "" ? undefined : BigInt(minOrderSize),
                maxBuyPrice: maxBuyPrice === "" ? undefined : BigInt(maxBuyPrice),
                minSellPrice: minSellPrice === "" ? undefined : BigInt(minSellPrice),
                spread: spread === "" ? undefined : BigInt(spread),
                minOrdersPerDirection:
                    minOrdersPerDirection === "" ? undefined : Number(minOrdersPerDirection),
                maxOrdersPerDirection:
                    maxOrdersPerDirection === "" ? undefined : Number(maxOrdersPerDirection),
                maxOrdersToMakePerIteration:
                    maxOrdersToMakePerIteration === ""
                        ? undefined
                        : Number(maxOrdersToMakePerIteration),
                maxOrdersToCancelPerIteration:
                    maxOrdersToCancelPerIteration === ""
                        ? undefined
                        : Number(maxOrdersToCancelPerIteration),
            };
        } catch (err) {
            toastStore.showFailureToast(i18nKey("Failed to create market maker config"), err);
            return undefined;
        }

        return config;
    }

    function addBusy(n: number) {
        busy.add(n);
        busy = busy;
    }

    function removeBusy(n: number) {
        busy.delete(n);
        busy = busy;
    }

    function setGroupUpgradeConcurrency(): void {
        error = undefined;
        addBusy(0);
        client
            .setGroupUpgradeConcurrency(parseInt(groupUpgradeConcurrency, 0))
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(
                        i18nKey(`Group upgrade concurrency set to ${groupUpgradeConcurrency}`),
                    );
                } else {
                    error = i18nKey(
                        `Failed to set group upgrade concurrency to ${groupUpgradeConcurrency}`,
                    );
                    toastStore.showFailureToast(error);
                }
            })
            .finally(() => {
                removeBusy(0);
            });
    }

    function setCommunityUpgradeConcurrency(): void {
        error = undefined;
        addBusy(1);
        client
            .setCommunityUpgradeConcurrency(parseInt(communityUpgradeConcurrency, 10))
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(
                        i18nKey(
                            `Community upgrade concurrency set to ${communityUpgradeConcurrency}`,
                        ),
                    );
                } else {
                    error = i18nKey(
                        `Failed to set community upgrade concurrency to ${communityUpgradeConcurrency}`,
                    );
                    toastStore.showFailureToast(error);
                }
            })
            .finally(() => {
                removeBusy(1);
            });
    }

    function setUserUpgradeConcurrency(): void {
        error = undefined;
        addBusy(2);
        client
            .setUserUpgradeConcurrency(parseInt(userUpgradeConcurrency, 10))
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(
                        i18nKey(`User upgrade concurrency set to ${userUpgradeConcurrency}`),
                    );
                } else {
                    error = i18nKey(
                        `Failed to set user upgrade concurrency to ${userUpgradeConcurrency}`,
                    );
                    toastStore.showFailureToast(error);
                }
            })
            .finally(() => {
                removeBusy(2);
            });
    }

    function strToBigInt(str: string): bigint | undefined {
        const n = Number(str);
        return isNaN(n) ? undefined : BigInt(n);
    }

    function mapFees(): DiamondMembershipFees[] {
        if (currentFees === undefined) return [];
        const mapped = Object.values(currentFees).reduce((res, val) => {
            res[val.token] = {
                token: val.token,
                oneMonth: strToBigInt(val.oneMonth) ?? res[val.token].oneMonth,
                threeMonths: strToBigInt(val.threeMonths) ?? res[val.token].threeMonths,
                oneYear: strToBigInt(val.oneYear) ?? res[val.token].oneYear,
                lifetime: strToBigInt(val.lifetime) ?? res[val.token].lifetime,
            };
            return res;
        }, originalFees);
        return Object.values(mapped);
    }

    function setDiamondMembershipFees(): void {
        error = undefined;
        addBusy(3);
        const mappedFees = mapFees();
        client
            .setDiamondMembershipFees(mappedFees)
            .then((success) => {
                if (success) {
                    originalFees = client.toRecord(mappedFees, (f) => f.token);
                    toastStore.showSuccessToast(i18nKey(`Diamond membership fees set`));
                } else {
                    error = i18nKey(`Failed to set diamond membership fees`);
                    toastStore.showFailureToast(error);
                }
            })
            .finally(() => {
                removeBusy(3);
            });
    }

    function stakeNeuronForSubmittingProposals(): void {
        error = undefined;
        const stakeVal = strToBigInt(stake);
        if (stakeVal !== undefined) {
            addBusy(4);
            client
                .stakeNeuronForSubmittingProposals(governanceCanisterId, stakeVal)
                .then((success) => {
                    if (success) {
                        toastStore.showSuccessToast(i18nKey("Neuron staked successfully"));
                    } else {
                        error = i18nKey("Failed to stake neuron");
                        toastStore.showFailureToast(error);
                    }
                })
                .finally(() => {
                    removeBusy(4);
                });
        }
    }

    function updateMarketMakerConfig(): void {
        error = undefined;
        const config = buildMarketMakerConfig();
        if (config !== undefined) {
            addBusy(5);
            client
                .updateMarketMakerConfig(config)
                .then((resp) => {
                    if (resp === "success") {
                        toastStore.showSuccessToast(i18nKey("Market maker config updated"));
                    } else {
                        error = i18nKey(`Failed to update market maker config: ${resp}`);
                        toastStore.showFailureToast(error);
                    }
                })
                .finally(() => {
                    removeBusy(5);
                });
        }
    }

    function proposeSetOpenAIApiKey(): void {
        error = undefined;
        addBusy(7);
        client
            .proposeSetOpenAIApiKey(openAiApiKey === "" ? undefined : openAiApiKey)
            .then((proposed) => onProposed(proposed, "OpenAI API key"))
            .finally(() => removeBusy(7));
    }

    function setModerationReferralConfig(): void {
        error = undefined;
        addBusy(9);
        const categories = Object.entries(referralThresholds)
            .filter(([_, t]) => t !== "")
            .map(([bit, t]) => ({ category: Number(bit), scoreThreshold: Number(t) }));
        const config = categories.length === 0 ? undefined : { categories };
        client
            .setModerationReferralConfig(config)
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(
                        i18nKey(
                            config === undefined
                                ? "Moderation referral disabled"
                                : "Moderation referral config updated",
                        ),
                    );
                } else {
                    error = i18nKey("Failed to update moderation referral config");
                    toastStore.showFailureToast(error);
                }
            })
            .finally(() => removeBusy(9));
    }

    // Replaces the full reviewer set: user ids must already be platform moderators
    function proposeSetVaultReviewers(): void {
        error = undefined;
        addBusy(10);
        const userIds = vaultReviewerIds
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id !== "");
        client
            .proposeSetVaultReviewers(userIds)
            .then((proposed) => onProposed(proposed, "vault reviewers"))
            .finally(() => removeBusy(10));
    }

    // A preservation request stops the retention clock deleting the evidence; clearing the hold
    // performs any release which was deferred while it was set
    function setVaultLegalHold(legalHold: boolean): void {
        error = undefined;
        const reportIndex = parseReportIndex(legalHoldReportIndex);
        if (reportIndex === undefined || legalHoldReference.trim() === "") {
            error = i18nKey("A report index and a request reference are both required");
            toastStore.showFailureToast(error);
            return;
        }
        addBusy(11);
        client
            .setVaultLegalHold(reportIndex, legalHold, legalHoldReference.trim())
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(
                        i18nKey(legalHold ? "Legal hold set" : "Legal hold cleared"),
                    );
                } else {
                    error = i18nKey("Failed to update the legal hold");
                    toastStore.showFailureToast(error);
                }
            })
            .finally(() => removeBusy(11));
    }

    // Irreversible, so dual authorized: this only proposes the destruction. A DIFFERENT
    // platform operator must confirm it below before anything is destroyed. A standing legal
    // hold blocks destruction outright - clear the hold first, as a separate act.
    function proposeDestroyVaultEvidence(): void {
        error = undefined;
        const reportIndex = parseReportIndex(destroyReportIndex);
        if (reportIndex === undefined || destroyRequestRef.trim() === "") {
            error = i18nKey("A report index and a law enforcement reference are both required");
            toastStore.showFailureToast(error);
            return;
        }
        addBusy(12);
        client
            .proposeDestroyVaultEvidence(reportIndex, destroyRequestRef.trim())
            .then((proposed) => {
                if (proposed !== undefined) {
                    destroyConfirmed = false;
                    destroyReportIndex = "";
                    destroyRequestRef = "";
                }
                onProposed(proposed, "destruction of vaulted evidence");
            })
            .finally(() => removeBusy(12));
    }

    function parseReportIndex(value: string): bigint | undefined {
        const trimmed = value.trim();
        return /^\d+$/.test(trimmed) ? BigInt(trimmed) : undefined;
    }

    function proposeSetInternalModerationChannel(): void {
        error = undefined;
        addBusy(8);
        const channelIdNum = parseInt(moderationChannelId, 10);
        const channel =
            moderationCommunityId === "" || isNaN(channelIdNum)
                ? undefined
                : { communityId: moderationCommunityId, channelId: channelIdNum };
        client
            .proposeSetInternalModerationChannel(channel)
            .then((proposed) => onProposed(proposed, "internal moderation channel"))
            .finally(() => removeBusy(8));
    }

    function setTokenEnabled(): void {
        error = undefined;
        addBusy(6);
        client
            .setTokenEnabled(tokenLedger, tokenEnabled)
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(
                        i18nKey(`Token enabled set successfully: ${tokenLedger}, ${tokenEnabled}`),
                    );
                } else {
                    error = i18nKey(`Failed to set token enabled: ${tokenLedger}, ${tokenEnabled}`);
                    toastStore.showFailureToast(error);
                }
            })
            .finally(() => {
                removeBusy(6);
            });
    }
</script>

<div class="operator">
    <section class="operator-function">
        <div class="title">Set group upgrade concurrency</div>
        <ButtonGroup align="fill">
            <Input invalid={groupUpgradeConcurrencyInvalid} bind:value={groupUpgradeConcurrency} />
            <Button
                tiny
                disabled={busy.has(0) || groupUpgradeConcurrencyInvalid}
                loading={busy.has(0)}
                onClick={setGroupUpgradeConcurrency}>Apply</Button
            >
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Set community upgrade concurrency</div>
        <ButtonGroup align="fill">
            <Input
                invalid={communityUpgradeConcurrencyInvalid}
                bind:value={communityUpgradeConcurrency}
            />
            <Button
                tiny
                disabled={busy.has(1) || communityUpgradeConcurrencyInvalid}
                loading={busy.has(1)}
                onClick={setCommunityUpgradeConcurrency}>Apply</Button
            >
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Set user upgrade concurrency</div>
        <ButtonGroup align="fill">
            <Input invalid={userUpgradeConcurrencyInvalid} bind:value={userUpgradeConcurrency} />
            <Button
                tiny
                disabled={busy.has(2) || userUpgradeConcurrencyInvalid}
                loading={busy.has(2)}
                onClick={setUserUpgradeConcurrency}>Apply</Button
            >
        </ButtonGroup>
    </section>

    {#if currentFees !== undefined}
        <section class="operator-function">
            <div class="title">Set Diamond membership fees</div>
            <div class="name-value">
                <div class="label">Token:</div>
                <div class="value">
                    <Select bind:value={feesTab}>
                        <option value="ICP">ICP</option>
                        <option value="CHAT">CHAT</option>
                    </Select>
                </div>
            </div>
            <div class="name-value">
                <div class="label">One month:</div>
                <div class="value">
                    <Input bind:value={currentFees[feesTab].oneMonth} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">Three month:</div>
                <div class="value">
                    <Input bind:value={currentFees[feesTab].threeMonths} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">One year:</div>
                <div class="value">
                    <Input bind:value={currentFees[feesTab].oneYear} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">Lifetime:</div>
                <div class="value">
                    <Input bind:value={currentFees[feesTab].lifetime} />
                </div>
            </div>
            <Button
                tiny
                disabled={busy.has(3)}
                loading={busy.has(3)}
                onClick={setDiamondMembershipFees}>Apply</Button
            >
        </section>
    {/if}

    <section class="operator-function">
        <div class="title">Stake neuron for submitting proposals</div>
        <div class="name-value">
            <div class="label">Governance Canister Id:</div>
            <div class="value">
                <Input bind:value={governanceCanisterId} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Stake:</div>
            <div class="value">
                <Input bind:value={stake} />
            </div>
        </div>
        <Button
            tiny
            disabled={busy.has(4)}
            loading={busy.has(4)}
            onClick={stakeNeuronForSubmittingProposals}>Apply</Button
        >
    </section>

    <section class="operator-function">
        <div class="title">Update market maker config</div>
        <div class="name-value">
            <div class="label">Exchange Id:</div>
            <div class="value">
                <Input invalid={exchangeIdInvalid} bind:value={exchangeId} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Enabled:</div>
            <div class="value">
                <Toggle small id="market-maker-enabled" bind:checked={enabled} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Price increment:</div>
            <div class="value">
                <Input bind:value={priceIncrement} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Order size:</div>
            <div class="value">
                <Input bind:value={orderSize} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Min order size:</div>
            <div class="value">
                <Input bind:value={minOrderSize} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Max buy price:</div>
            <div class="value">
                <Input bind:value={maxBuyPrice} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Min sell price:</div>
            <div class="value">
                <Input bind:value={minSellPrice} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Spread:</div>
            <div class="value">
                <Input bind:value={spread} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Min orders per direction:</div>
            <div class="value">
                <Input bind:value={minOrdersPerDirection} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Max orders per direction:</div>
            <div class="value">
                <Input bind:value={maxOrdersPerDirection} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Max orders to make per iteration:</div>
            <div class="value">
                <Input bind:value={maxOrdersToMakePerIteration} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Max orders to cancel per iteration:</div>
            <div class="value">
                <Input bind:value={maxOrdersToCancelPerIteration} />
            </div>
        </div>
        <Button
            tiny
            disabled={busy.has(5) || exchangeIdInvalid}
            loading={busy.has(5)}
            onClick={updateMarketMakerConfig}>Apply</Button
        >
    </section>

    <section class="operator-function">
        <div class="title">Set token enabled</div>
        <ButtonGroup align="fill">
            <Input invalid={!tokenLedgerValid} bind:value={tokenLedger} />
            <Toggle small id="token-enabled" bind:checked={tokenEnabled} />
            <Button
                tiny
                disabled={busy.has(6) || !tokenLedgerValid}
                loading={busy.has(6)}
                onClick={setTokenEnabled}>Apply</Button
            >
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">
            Set OpenAI API key (moderation) {openAiKeySet ? "- currently set" : "- NOT SET"}
        </div>
        <div class="name-value">
            <div class="label">API key:</div>
            <div class="value">
                <Input bind:value={openAiApiKey} />
            </div>
        </div>
        <Button tiny disabled={busy.has(7)} loading={busy.has(7)} onClick={proposeSetOpenAIApiKey}>
            Apply
        </Button>
    </section>

    <section class="operator-function">
        <div class="title">Set moderation referral config</div>
        <div class="hint">
            Per-category score thresholds (0-1) above which a message is referred for human
            moderator review. Leave a category blank to disable it. All blank = referral disabled.
        </div>
        {#each MODERATION_CATEGORY_NAMES.filter(([bit, _]) => bit !== CSAM_CATEGORY_BIT) as [bit, name] (bit)}
            <div class="name-value">
                <div class="label">{name}:</div>
                <div class="value">
                    <Input
                        placeholder={i18nKey("disabled")}
                        bind:value={
                            () => referralThresholds[bit] ?? "",
                            (v) => (referralThresholds[bit] = v)
                        }
                    />
                </div>
            </div>
        {/each}
        <Button
            tiny
            disabled={busy.has(9) || referralThresholdsInvalid}
            loading={busy.has(9)}
            onClick={setModerationReferralConfig}>Apply</Button
        >
    </section>

    <section class="operator-function">
        <div class="title">Set vault reviewers</div>
        <div class="hint">
            Comma-separated user ids. Replaces the whole set; each must already be a platform
            moderator. An empty list revokes all reviewers.
        </div>
        <ButtonGroup align="fill">
            <Input bind:value={vaultReviewerIds} />
            <Button tiny disabled={busy.has(10)} loading={busy.has(10)} onClick={proposeSetVaultReviewers}>
                Apply
            </Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Vault legal hold</div>
        <div class="hint">
            Preservation request: suspends the retention clock for a report's vaulted evidence, so
            it is never deleted at expiry. Clearing the hold performs any release which was
            deferred while it was set.
        </div>
        <div class="name-value">
            <div class="label">Report index:</div>
            <div class="value">
                <Input bind:value={legalHoldReportIndex} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Request reference:</div>
            <div class="value">
                <Input bind:value={legalHoldReference} />
            </div>
        </div>
        <ButtonGroup align="fill">
            <Button
                tiny
                disabled={busy.has(11)}
                loading={busy.has(11)}
                onClick={() => setVaultLegalHold(true)}>Set hold</Button>
            <Button
                tiny
                secondary
                disabled={busy.has(11)}
                loading={busy.has(11)}
                onClick={() => setVaultLegalHold(false)}>Clear hold</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Pending protected actions</div>
        <div class="hint">
            Destroying vaulted evidence, designating vault reviewers, setting the OpenAI API key
            and setting the moderation channel are dual authorized: one operator proposes, a
            different operator confirms. Proposing another change of the same kind replaces the
            pending one (the replacement gets a new id), proposals expire after 14 days, and
            anyone can cancel.
        </div>
        {#if pendingActions.length === 0}
            <div class="hint">Nothing pending.</div>
        {:else}
            {#each pendingActions as action (action.id)}
                <div class="name-value">
                    <div class="label">#{action.id} {action.summary}</div>
                    <div class="value">
                        <ButtonGroup align="fill">
                            <Button
                                tiny
                                disabled={busy.has(13)}
                                loading={busy.has(13)}
                                onClick={() => confirmProtectedAction(action.id)}>Confirm</Button>
                            <Button
                                tiny
                                secondary
                                disabled={busy.has(14)}
                                loading={busy.has(14)}
                                onClick={() => cancelProtectedAction(action.id)}>Cancel</Button>
                        </ButtonGroup>
                    </div>
                </div>
            {/each}
        {/if}
    </section>

    <section class="operator-function">
        <div class="title">Propose destruction of vaulted evidence</div>
        <div class="hint">
            Law enforcement destruction request. Irreversible, so this only PROPOSES the
            destruction: a different platform operator must confirm it above before anything is
            destroyed. A standing legal hold blocks destruction - clear the hold first, as a
            separate act. The reference and both operator identities are recorded in the vault
            log, which survives the destruction.
        </div>
        <div class="name-value">
            <div class="label">Report index:</div>
            <div class="value">
                <Input bind:value={destroyReportIndex} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">LE request reference:</div>
            <div class="value">
                <Input bind:value={destroyRequestRef} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Request verified:</div>
            <div class="value">
                <Toggle small id="confirm-destroy-vault-evidence" bind:checked={destroyConfirmed} />
            </div>
        </div>
        <Button
            tiny
            disabled={busy.has(12) || !destroyConfirmed}
            loading={busy.has(12)}
            onClick={proposeDestroyVaultEvidence}>Propose</Button>
    </section>

    <section class="operator-function">
        <div class="title">Set internal moderation channel</div>
        <div class="name-value">
            <div class="label">Community Id:</div>
            <div class="value">
                <Input bind:value={moderationCommunityId} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Channel Id:</div>
            <div class="value">
                <Input bind:value={moderationChannelId} />
            </div>
        </div>
        <Button
            tiny
            disabled={busy.has(8)}
            loading={busy.has(8)}
            onClick={proposeSetInternalModerationChannel}>Apply</Button
        >
    </section>

    <section class="operator-function">
        <ButtonGroup align="fill">
            <h4>Pause event loop</h4>
            <Button tiny onClick={() => client.pauseEventLoop()}>Pause</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <ButtonGroup align="fill">
            <h4>Resume event loop</h4>
            <Button tiny onClick={() => client.resumeEventLoop()}>Resume</Button>
        </ButtonGroup>
    </section>

    {#if error}
        <ErrorMessage>
            <Translatable resourceKey={error} />
        </ErrorMessage>
    {/if}
</div>

<style lang="scss">
    :global(.operator-function .button-group > :nth-child(2)) {
        flex: 0 0 100px;
        height: 40px;
    }
    :global(.operator-function .button-group > :nth-child(1)) {
        flex: auto;
    }

    .operator {
        flex: auto;
        @include nice-scrollbar();
        padding: $sp4;
        max-width: 600px;
    }

    .operator-function {
        padding: $sp3;
        border: var(--bw) solid var(--bd);
        border-radius: $sp2;
        margin-bottom: $sp5;
    }

    .name-value {
        width: 100%;
        display: flex;
        align-items: center;
        gap: $sp3;

        .label {
            flex: 0 0 150px;
            color: var(--txt-light);
            @include font(light, normal, fs-80);
        }

        .value {
            flex: auto;
        }
    }

    .title {
        margin-bottom: $sp3;
        @include font(bold, normal, fs-100);
    }

    .hint {
        margin-bottom: $sp3;
        color: var(--txt-light);
        @include font(light, normal, fs-80);
    }
</style>

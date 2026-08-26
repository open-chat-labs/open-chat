<script lang="ts">
    import {
        MODERATION_CATEGORY_NAMES,
        type DiamondMembershipFees,
        type OpenChat,
        type ProposedProtectedAction,
        type ResourceKey,
        type UpdateMarketMakerConfigArgs,
    } from "@client";
    import { Principal } from "@icp-sdk/core/principal";
    import { Body, BodySmall, ColourVars, Column, Row, Subtitle, Title } from "component-lib";
    import { getContext, onMount, type Snippet } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
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
    let busy = $state(new SvelteSet<number>());
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
    let mediaScanEnabled = $state(false);
    let mediaScanScanners = $state("");
    let currentMediaScan = $state("");
    let authorityReporter = $state("");
    let currentAuthorityReporter = $state("");
    // Current values shown alongside the proposed ones, so an operator can see what a proposal
    // would actually change
    let currentVaultReviewers = $state("");
    let currentModerationChannel = $state("");

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
                    : `Proposed ${what} as action #${proposed.actionId} - NOT yet applied: a different platform operator must confirm it under Pending proposals`,
            ),
        );
    }

    onMount(() => {
        // Pre-fill the moderation config so the forms show what is actually set rather than
        // being write-only
        client.moderationConfig().then((config) => {
            if (config === undefined) return;
            openAiKeySet = config.openaiApiKeySet;
            if (config.internalModerationChannel !== undefined) {
                moderationCommunityId = config.internalModerationChannel.communityId;
                moderationChannelId = config.internalModerationChannel.channelId.toString();
                currentModerationChannel = `${config.internalModerationChannel.communityId} / ${config.internalModerationChannel.channelId}`;
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
            currentVaultReviewers = config.vaultReviewers.join(", ");
            mediaScanEnabled = config.mediaScanEnabled;
            mediaScanScanners = config.mediaScanners.join(", ");
            currentMediaScan = `${config.mediaScanEnabled ? "Enabled" : "Disabled"} (${
                config.mediaScanners.length === 0 ? "no scanners" : config.mediaScanners.join(", ")
            })`;
            authorityReporter = config.authorityReporter ?? "";
            currentAuthorityReporter = config.authorityReporter ?? "";
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

    function proposeSetMediaScanConfig(): void {
        error = undefined;
        const scanners = mediaScanScanners
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id !== "");
        const invalid = scanners.find((id) => !isValidPrincipal(id));
        if (invalid !== undefined) {
            error = i18nKey(`"${invalid}" is not a valid principal`);
            toastStore.showFailureToast(error);
            return;
        }
        addBusy(13);
        client
            .proposeSetMediaScanConfig(mediaScanEnabled, scanners)
            .then((proposed) => onProposed(proposed, "media scan config"))
            .finally(() => removeBusy(13));
    }

    // Registers (or clears) the off-chain NCA reporting service's principal
    function proposeSetAuthorityReporter(): void {
        error = undefined;
        const principal = authorityReporter.trim();
        if (principal !== "" && !isValidPrincipal(principal)) {
            error = i18nKey(`"${principal}" is not a valid principal`);
            toastStore.showFailureToast(error);
            return;
        }
        addBusy(14);
        client
            .proposeSetAuthorityReporter(principal === "" ? undefined : principal)
            .then((proposed) => onProposed(proposed, "authority reporter"))
            .finally(() => removeBusy(14));
    }

    // Replaces the full reviewer set: user ids must already be platform moderators
    function proposeSetVaultReviewers(): void {
        error = undefined;
        const userIds = vaultReviewerIds
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id !== "");
        const invalid = userIds.find((id) => !isValidPrincipal(id));
        if (invalid !== undefined) {
            error = i18nKey(`"${invalid}" is not a valid user id`);
            toastStore.showFailureToast(error);
            return;
        }
        addBusy(10);
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
                    return;
                }
                // Clearing a hold whose release is already pending performs that release, so
                // the canister refuses it here and it has to be proposed instead. The propose
                // runs its own validation, so a clear which failed for another reason (a bad
                // report index, say) surfaces that failure here rather than being swallowed
                if (!legalHold) {
                    return client
                        .proposeSetVaultLegalHold(reportIndex, false, legalHoldReference.trim())
                        .then((proposed) =>
                            onProposed(
                                proposed,
                                "clearing this legal hold (it would release the evidence)",
                            ),
                        );
                }
                error = i18nKey("Failed to update the legal hold");
                toastStore.showFailureToast(error);
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
                    destroyReportIndex = "";
                    destroyRequestRef = "";
                }
                onProposed(proposed, "destruction of vaulted evidence");
            })
            .finally(() => removeBusy(12));
    }

    function isValidPrincipal(value: string): boolean {
        try {
            Principal.fromText(value);
            return true;
        } catch {
            return false;
        }
    }

    function parseReportIndex(value: string): bigint | undefined {
        const trimmed = value.trim();
        return /^\d+$/.test(trimmed) ? BigInt(trimmed) : undefined;
    }

    function proposeSetInternalModerationChannel(): void {
        error = undefined;
        const communityId = moderationCommunityId.trim();
        const channelId = moderationChannelId.trim();

        // Both blank is the deliberate "switch alerts off" case. Anything else must be a
        // complete, well-formed pair: partial or malformed input previously fell through to
        // `undefined`, silently proposing to unset the channel
        let channel: { communityId: string; channelId: number } | undefined;
        if (communityId !== "" || channelId !== "") {
            if (communityId === "" || channelId === "") {
                error = i18nKey(
                    "A community id and a channel id are both required (leave both blank to unset the channel)",
                );
                toastStore.showFailureToast(error);
                return;
            }
            if (!isValidPrincipal(communityId)) {
                error = i18nKey("That is not a valid community id");
                toastStore.showFailureToast(error);
                return;
            }
            const channelIdNum = Number(channelId);
            if (!/^\d+$/.test(channelId) || !Number.isSafeInteger(channelIdNum)) {
                error = i18nKey("The channel id must be a whole number");
                toastStore.showFailureToast(error);
                return;
            }
            channel = { communityId, channelId: channelIdNum };
        }

        addBusy(8);
        client
            .proposeSetInternalModerationChannel(channel)
            .then((proposed) =>
                onProposed(
                    proposed,
                    channel === undefined
                        ? "unsetting the internal moderation channel"
                        : "internal moderation channel",
                ),
            )
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

{#snippet proposedDestroyVaultView()}
    <Column gap="md">
        {@const labelWidth = { size: "8rem" }}
        <Row gap="md">
            <BodySmall width={labelWidth} colour="textSecondary" uppercase>Report index:</BodySmall>
            <Input bind:value={destroyReportIndex} />
        </Row>
        <Row gap="md">
            <BodySmall width={labelWidth} colour="textSecondary" uppercase
                >LE request reference:</BodySmall>
            <Input bind:value={destroyRequestRef} />
        </Row>
    </Column>
{/snippet}

{#snippet currentModerationChannelView()}
    <Input disabled value={currentModerationChannel || "Not set"} />
{/snippet}

{#snippet proposedModerationChannelView()}
    <Input bind:value={moderationCommunityId} placeholder={i18nKey("Community id")} />
    <Input bind:value={moderationChannelId} placeholder={i18nKey("Channel id")} />
{/snippet}

{#snippet currentVaultReviewersView()}
    <Input disabled value={currentVaultReviewers || "None"} />
{/snippet}

{#snippet proposedVaultReviewersView()}
    <Input bind:value={vaultReviewerIds} placeholder={i18nKey("Comma separated reviewer Ids")} />
{/snippet}

{#snippet currentOpenAIKey()}
    <Input disabled value={openAiKeySet ? "Set" : "Not set"} />
{/snippet}

{#snippet currentAuthorityReporterView()}
    <Input disabled value={currentAuthorityReporter || "None"} />
{/snippet}

{#snippet proposedAuthorityReporterView()}
    <Input
        bind:value={authorityReporter}
        placeholder={i18nKey("Service principal (blank to unregister)")} />
{/snippet}

{#snippet currentMediaScanView()}
    <Input disabled value={currentMediaScan || "Disabled (no scanners)"} />
{/snippet}

{#snippet proposedMediaScanView()}
    <Toggle small id="media-scan-enabled" bind:checked={mediaScanEnabled} />
    <Input bind:value={mediaScanScanners} placeholder={i18nKey("Comma separated scanner principals")} />
{/snippet}

{#snippet proposedOpenAIKey()}
    <Input bind:value={openAiApiKey} placeholder={i18nKey("New key (blank to unset)")} />
{/snippet}

{#snippet dualSetting(
    name: string,
    desc: string,
    index: number,
    onPropose: () => void,
    proposed: Snippet<[]>,
    current?: Snippet<[]>,
)}
    <Column backgroundColor={ColourVars.background0} borderRadius="md" padding="lg" gap="lg">
        <Column gap="xs">
            <Subtitle>{name}</Subtitle>
            <Body colour="textSecondary">{desc}</Body>
        </Column>
        {#if current}
            <Row mainAxisAlignment="spaceBetween" gap="lg">
                <Column gap="xs">
                    <BodySmall colour="textSecondary" uppercase>Current</BodySmall>
                    {@render current()}
                </Column>
                <Column gap="xs">
                    <BodySmall colour="textSecondary" uppercase>Proposed</BodySmall>
                    {@render proposed()}
                </Column>
            </Row>
        {:else}
            {@render proposed()}
        {/if}
        <Button disabled={busy.has(index)} loading={busy.has(index)} onClick={onPropose}>
            Propose
        </Button>
    </Column>
{/snippet}

<div class="operator">
    <section class="operator-function">
        <div class="title">Set group upgrade concurrency</div>
        <ButtonGroup align="fill">
            <Input invalid={groupUpgradeConcurrencyInvalid} bind:value={groupUpgradeConcurrency} />
            <Button
                tiny
                disabled={busy.has(0) || groupUpgradeConcurrencyInvalid}
                loading={busy.has(0)}
                onClick={setGroupUpgradeConcurrency}>Apply</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Set community upgrade concurrency</div>
        <ButtonGroup align="fill">
            <Input
                invalid={communityUpgradeConcurrencyInvalid}
                bind:value={communityUpgradeConcurrency} />
            <Button
                tiny
                disabled={busy.has(1) || communityUpgradeConcurrencyInvalid}
                loading={busy.has(1)}
                onClick={setCommunityUpgradeConcurrency}>Apply</Button>
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
                onClick={setUserUpgradeConcurrency}>Apply</Button>
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
                onClick={setDiamondMembershipFees}>Apply</Button>
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
            onClick={stakeNeuronForSubmittingProposals}>Apply</Button>
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
            onClick={updateMarketMakerConfig}>Apply</Button>
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
                onClick={setTokenEnabled}>Apply</Button>
        </ButtonGroup>
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
                        } />
                </div>
            </div>
        {/each}
        <Button
            tiny
            disabled={busy.has(9) || referralThresholdsInvalid}
            loading={busy.has(9)}
            onClick={setModerationReferralConfig}>Apply</Button>
    </section>

    <section class="operator-function">
        <div class="title">Vault legal hold</div>
        <div class="hint">
            Suspends the retention clock so evidence outlasts the ordinary retention period.
            Clearing a hold on evidence whose release is already pending performs that release and
            destroys it, so that one case is proposed for a second operator to confirm.
        </div>
        <div class="hint">
            Preservation request: suspends the retention clock for a report's vaulted evidence, so
            it is never deleted at expiry. Clearing the hold performs any release which was deferred
            while it was set.
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

    <Column
        backgroundColor="color-mix(in srgb, var(--warning), transparent 90%)"
        borderColour={ColourVars.warning}
        borderWidth="thin"
        supplementalClass="danger_zone"
        borderRadius="md"
        padding="lg"
        gap="xl">
        <Column gap="md" padding={["zero", "lg"]}>
            <Title fontWeight="bold">Danger Zone</Title>
            <Subtitle>Dual auth operator actions</Subtitle>
            <Body fontWeight="light">
                Everything below is <strong>dual authorized</strong>: you propose the change, and a
                different platform operator confirms or rejects it. Nothing here takes effect when
                you press Propose. Pending proposals - yours and other operators' - are listed under
                the
                <strong>Pending proposals</strong> tab.
            </Body>
        </Column>

        {@render dualSetting(
            "OpenAI API key (moderation)",
            "Arms the classification pipeline on every local user index. Setting it starts proactive detection and the reporting duties which follow from it.",
            7,
            proposeSetOpenAIApiKey,
            proposedOpenAIKey,
            currentOpenAIKey,
        )}

        {@render dualSetting(
            "Media scanning (known-CSAM hash matching)",
            "Arms the media scan pipeline on every local user index and registers the worker principals allowed to collect scan jobs and submit verdicts. The toggle is the kill switch: while disabled, scan requests are dropped. Enabling requires at least one scanner principal.",
            13,
            proposeSetMediaScanConfig,
            proposedMediaScanView,
            currentMediaScanView,
        )}

        {@render dualSetting(
            "NCA reporting service (authority reporter)",
            "Registers the principal of the off-chain service which files CSEA reports with the NCA. The principal alone exports nothing: every filing additionally needs a signed, report-scoped token from a vault reviewer. Registering also delivers the OC public key to the storage buckets. Blank unregisters and disables automated filing.",
            14,
            proposeSetAuthorityReporter,
            proposedAuthorityReporterView,
            currentAuthorityReporterView,
        )}

        {@render dualSetting(
            "Vault reviewers",
            "Grants access to quarantined material. Comma-separated user ids; replaces the whole set; each must already be a platform moderator. An empty list revokes all reviewers.",
            10,
            proposeSetVaultReviewers,
            proposedVaultReviewersView,
            currentVaultReviewersView,
        )}

        {@render dualSetting(
            "Internal moderation channel",
            "Where moderation alerts - including report excerpts and context - are posted.",
            8,
            proposeSetInternalModerationChannel,
            proposedModerationChannelView,
            currentModerationChannelView,
        )}

        {@render dualSetting(
            "Destroy vaulted evidence",
            "Law enforcement destruction request. Irreversible: the blobs are removed even if a message still references them. A standing legal hold blocks destruction - clear the hold first, as a separate act. The reference and both operator identities are recorded in the vault log, which survives the destruction. ",
            12,
            proposeDestroyVaultEvidence,
            proposedDestroyVaultView,
        )}
    </Column>

    {#if error}
        <ErrorMessage>
            <Translatable resourceKey={error} />
        </ErrorMessage>
    {/if}
</div>

<style lang="scss">
    :global(.danger_zone .input-wrapper) {
        width: 100%;
    }

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

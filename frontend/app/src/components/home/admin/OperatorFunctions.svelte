<script lang="ts">
    import { BRIDGE_PLATFORM_NAMES, type BridgePlatform, type OpenChat } from "@client";
    import { Body, BodySmall, ColourVars, Column, Row, Subtitle, Title } from "component-lib";
    import { getContext, onMount, type Snippet } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import {
        BRIDGE_PLATFORMS,
        OperatorFunctions,
        REFERRAL_CATEGORIES,
        type OperatorAction,
        type OperatorOutcome,
    } from "../../../logic/admin/operatorFunctions.svelte";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Input from "../../Input.svelte";
    import Select from "../../Select.svelte";
    import Toggle from "../../Toggle.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import DailyPuzzleOperator from "./DailyPuzzleOperator.svelte";

    const client = getContext<OpenChat>("client");
    const ops = new OperatorFunctions(client);

    let error = $derived(ops.error);
    let busy = $derived(ops.busy);

    onMount(() => ops.load());

    function report(outcome: OperatorOutcome | undefined): void {
        if (outcome?.kind === "success") {
            toastStore.showSuccessToast(outcome.message);
        } else if (outcome?.kind === "failed") {
            toastStore.showFailureToast(outcome.message, outcome.err);
        }
    }

    async function run(action: () => Promise<OperatorOutcome | undefined>): Promise<void> {
        report(await action());
    }

    const applyCallPush = () => run(() => ops.applyCallPush());
    const setAlchemyApiKey = (apiKey: string | undefined) =>
        run(() => ops.setAlchemyApiKey(apiKey));
    const setMiniAppServicePrincipal = () => run(() => ops.setMiniAppServicePrincipal());
    const setBridgeBot = (platform: BridgePlatform, botId: string | undefined) =>
        run(() => ops.setBridgeBot(platform, botId));
    const setGroupUpgradeConcurrency = () => run(() => ops.setGroupUpgradeConcurrency());
    const setCommunityUpgradeConcurrency = () => run(() => ops.setCommunityUpgradeConcurrency());
    const createMultiUserCanister = () => run(() => ops.createMultiUserCanister());
    const setDiamondMembershipFees = () => run(() => ops.setDiamondMembershipFees());
    const stakeNeuronForSubmittingProposals = () =>
        run(() => ops.stakeNeuronForSubmittingProposals());
    const proposeSetOpenAIApiKey = () => run(() => ops.proposeSetOpenAIApiKey());
    const setModerationReferralConfig = () => run(() => ops.setModerationReferralConfig());
    const proposeSetMediaScanConfig = () => run(() => ops.proposeSetMediaScanConfig());
    const proposeSetAuthorityReporter = () => run(() => ops.proposeSetAuthorityReporter());
    const proposeSetVaultReviewers = () => run(() => ops.proposeSetVaultReviewers());
    const setVaultLegalHold = (legalHold: boolean) => run(() => ops.setVaultLegalHold(legalHold));
    const proposeDestroyVaultEvidence = () => run(() => ops.proposeDestroyVaultEvidence());
    const proposeSetInternalModerationChannel = () =>
        run(() => ops.proposeSetInternalModerationChannel());
    const setTokenEnabled = () => run(() => ops.setTokenEnabled());
</script>

{#snippet proposedDestroyVaultView()}
    <Column gap="md">
        {@const labelWidth = { size: "8rem" }}
        <Row gap="md">
            <BodySmall width={labelWidth} colour="textSecondary" uppercase>Report index:</BodySmall>
            <Input bind:value={ops.destroyReportIndex} />
        </Row>
        <Row gap="md">
            <BodySmall width={labelWidth} colour="textSecondary" uppercase
                >LE request reference:</BodySmall>
            <Input bind:value={ops.destroyRequestRef} />
        </Row>
    </Column>
{/snippet}

{#snippet currentModerationChannelView()}
    <Input disabled value={ops.currentModerationChannel || "Not set"} />
{/snippet}

{#snippet proposedModerationChannelView()}
    <Input bind:value={ops.moderationCommunityId} placeholder={i18nKey("Community id")} />
    <Input bind:value={ops.moderationChannelId} placeholder={i18nKey("Channel id")} />
{/snippet}

{#snippet currentVaultReviewersView()}
    <Input disabled value={ops.currentVaultReviewers || "None"} />
{/snippet}

{#snippet proposedVaultReviewersView()}
    <Input bind:value={ops.vaultReviewerIds} placeholder={i18nKey("Comma separated reviewer Ids")} />
{/snippet}

{#snippet currentOpenAIKey()}
    <Input disabled value={ops.openAiKeySet ? "Set" : "Not set"} />
{/snippet}

{#snippet currentAuthorityReporterView()}
    <Input disabled value={ops.currentAuthorityReporter || "None"} />
{/snippet}

{#snippet proposedAuthorityReporterView()}
    <Input
        bind:value={ops.authorityReporter}
        placeholder={i18nKey("Service principal (blank to unregister)")} />
{/snippet}

{#snippet currentMediaScanView()}
    <Input disabled value={ops.currentMediaScan || "Disabled (no scanners)"} />
{/snippet}

{#snippet proposedMediaScanView()}
    <Toggle small id="media-scan-enabled" bind:checked={ops.mediaScanEnabled} />
    <Input
        bind:value={ops.mediaScanScanners}
        placeholder={i18nKey("Comma separated scanner principals")} />
{/snippet}

{#snippet proposedOpenAIKey()}
    <Input bind:value={ops.openAiApiKey} placeholder={i18nKey("New key (blank to unset)")} />
{/snippet}

{#snippet dualSetting(
    name: string,
    desc: string,
    action: OperatorAction,
    onPropose: () => void,
    proposed: Snippet<[]>,
    current?: Snippet<[]>,
)}
    <Column backgroundColor={ColourVars.surface0} borderRadius="md" padding="lg" gap="lg">
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
        <Button disabled={busy.has(action)} loading={busy.has(action)} onClick={onPropose}>
            Propose
        </Button>
    </Column>
{/snippet}

<div class="operator">
    <section class="operator-function">
        <div class="title">Set group upgrade concurrency</div>
        <ButtonGroup align="fill">
            <Input invalid={ops.groupUpgradeConcurrencyInvalid} bind:value={ops.groupUpgradeConcurrency} />
            <Button
                tiny
                disabled={busy.has("groupUpgradeConcurrency") || ops.groupUpgradeConcurrencyInvalid}
                loading={busy.has("groupUpgradeConcurrency")}
                onClick={setGroupUpgradeConcurrency}>Apply</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Set community upgrade concurrency</div>
        <ButtonGroup align="fill">
            <Input
                invalid={ops.communityUpgradeConcurrencyInvalid}
                bind:value={ops.communityUpgradeConcurrency} />
            <Button
                tiny
                disabled={busy.has("communityUpgradeConcurrency") || ops.communityUpgradeConcurrencyInvalid}
                loading={busy.has("communityUpgradeConcurrency")}
                onClick={setCommunityUpgradeConcurrency}>Apply</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Create MultiUser canister</div>
        <ButtonGroup align="fill">
            <Input
                invalid={ops.multiUserCanisterLocalUserIndexInvalid}
                placeholder={i18nKey("LocalUserIndex canister id")}
                bind:value={ops.multiUserCanisterLocalUserIndex} />
            <Button
                tiny
                disabled={busy.has("multiUserCanister") || ops.multiUserCanisterLocalUserIndexInvalid}
                loading={busy.has("multiUserCanister")}
                onClick={createMultiUserCanister}>Create</Button>
        </ButtonGroup>
    </section>

    {#if ops.currentFees !== undefined}
        <section class="operator-function">
            <div class="title">Set Diamond membership fees</div>
            <div class="name-value">
                <div class="label">Token:</div>
                <div class="value">
                    <Select bind:value={ops.feesTab}>
                        <option value="ICP">ICP</option>
                        <option value="CHAT">CHAT</option>
                    </Select>
                </div>
            </div>
            <div class="name-value">
                <div class="label">One month:</div>
                <div class="value">
                    <Input bind:value={ops.currentFees[ops.feesTab].oneMonth} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">Three month:</div>
                <div class="value">
                    <Input bind:value={ops.currentFees[ops.feesTab].threeMonths} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">One year:</div>
                <div class="value">
                    <Input bind:value={ops.currentFees[ops.feesTab].oneYear} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">Lifetime:</div>
                <div class="value">
                    <Input bind:value={ops.currentFees[ops.feesTab].lifetime} />
                </div>
            </div>
            <Button
                tiny
                disabled={busy.has("diamondFees")}
                loading={busy.has("diamondFees")}
                onClick={setDiamondMembershipFees}>Apply</Button>
        </section>
    {/if}

    <section class="operator-function">
        <div class="title">Stake neuron for submitting proposals</div>
        <div class="name-value">
            <div class="label">Governance Canister Id:</div>
            <div class="value">
                <Input bind:value={ops.governanceCanisterId} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Stake:</div>
            <div class="value">
                <Input bind:value={ops.stake} />
            </div>
        </div>
        <Button
            tiny
            disabled={busy.has("stakeNeuron")}
            loading={busy.has("stakeNeuron")}
            onClick={stakeNeuronForSubmittingProposals}>Apply</Button>
    </section>

    <section class="operator-function">
        <div class="title">Set token enabled</div>
        <ButtonGroup align="fill">
            <Input invalid={!ops.tokenLedgerValid} bind:value={ops.tokenLedger} />
            <Toggle small id="token-enabled" bind:checked={ops.tokenEnabled} />
            <Button
                tiny
                disabled={busy.has("tokenEnabled") || !ops.tokenLedgerValid}
                loading={busy.has("tokenEnabled")}
                onClick={setTokenEnabled}>Apply</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Set moderation referral config</div>
        <div class="hint">
            Per-category score thresholds (0-1) above which a message is referred for human
            moderator review. Leave a category blank to disable it. All blank = referral disabled.
        </div>
        {#each REFERRAL_CATEGORIES as [bit, name] (bit)}
            <div class="name-value">
                <div class="label">{name}:</div>
                <div class="value">
                    <Input
                        placeholder={i18nKey("disabled")}
                        bind:value={
                            () => ops.referralThreshold(bit),
                            (v) => ops.setReferralThreshold(bit, v)
                        } />
                </div>
            </div>
        {/each}
        <Button
            tiny
            disabled={busy.has("referralConfig") || ops.referralThresholdsInvalid}
            loading={busy.has("referralConfig")}
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
                <Input bind:value={ops.legalHoldReportIndex} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Request reference:</div>
            <div class="value">
                <Input bind:value={ops.legalHoldReference} />
            </div>
        </div>
        <ButtonGroup align="fill">
            <Button
                tiny
                disabled={busy.has("legalHold")}
                loading={busy.has("legalHold")}
                onClick={() => setVaultLegalHold(true)}>Set hold</Button>
            <Button
                tiny
                secondary
                disabled={busy.has("legalHold")}
                loading={busy.has("legalHold")}
                onClick={() => setVaultLegalHold(false)}>Clear hold</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Native call push</div>
        <div class="name-value">
            <div class="label">Enabled:</div>
            <div class="value">
                <Toggle small id="call-push-enabled" bind:checked={ops.callPushEnabled} />
            </div>
        </div>
        <Button tiny loading={busy.has("callPush")} disabled={busy.has("callPush")} onClick={applyCallPush}>
            Apply
        </Button>
    </section>

    <section class="operator-function">
        <div class="title">Alchemy API key (Solana RPC)</div>
        <Input bind:value={ops.alchemyApiKey} placeholder={i18nKey("New key")} />
        <ButtonGroup align="fill">
            <Button
                tiny
                loading={busy.has("alchemyKey")}
                disabled={busy.has("alchemyKey") || ops.alchemyApiKey.trim() === ""}
                onClick={() => setAlchemyApiKey(ops.alchemyApiKey.trim())}>Set</Button>
            <Button
                tiny
                secondary
                loading={busy.has("alchemyKey")}
                disabled={busy.has("alchemyKey")}
                onClick={() => setAlchemyApiKey(undefined)}>Unset</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">MiniApp service principal</div>
        <Input bind:value={ops.miniAppServicePrincipal} placeholder={i18nKey("Service principal")} />
        <Button
            tiny
            loading={busy.has("miniAppPrincipal")}
            disabled={busy.has("miniAppPrincipal") || ops.miniAppServicePrincipal.trim() === ""}
            onClick={setMiniAppServicePrincipal}>Set</Button>
    </section>

    {#each BRIDGE_PLATFORMS as platform}
        <section class="operator-function">
            <div class="title">{BRIDGE_PLATFORM_NAMES[platform]} bridge bot</div>
            <Input bind:value={ops.bridgeBotIds[platform]} placeholder={i18nKey("Bot id")} />
            <ButtonGroup align="fill">
                <Button
                    tiny
                    loading={busy.has("bridgeBot")}
                    disabled={busy.has("bridgeBot") || ops.bridgeBotIds[platform].trim() === ""}
                    onClick={() => setBridgeBot(platform, ops.bridgeBotIds[platform].trim())}
                    >Set</Button>
                <Button
                    tiny
                    secondary
                    loading={busy.has("bridgeBot")}
                    disabled={busy.has("bridgeBot")}
                    onClick={() => setBridgeBot(platform, undefined)}>Unset</Button>
            </ButtonGroup>
        </section>
    {/each}

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

    <DailyPuzzleOperator />

    <Column
        backgroundColor="color-mix(in srgb, var(--warning), transparent 90%)"
        borderColour={ColourVars.validationWarning}
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
            "openAiKey",
            proposeSetOpenAIApiKey,
            proposedOpenAIKey,
            currentOpenAIKey,
        )}

        {@render dualSetting(
            "Media scanning (known-CSAM hash matching)",
            "Arms the media scan pipeline on every local user index and registers the worker principals allowed to collect scan jobs and submit verdicts. The toggle is the kill switch: while disabled, scan requests are dropped. Enabling requires at least one scanner principal.",
            "mediaScan",
            proposeSetMediaScanConfig,
            proposedMediaScanView,
            currentMediaScanView,
        )}

        {@render dualSetting(
            "NCA reporting service (authority reporter)",
            "Registers the principal of the off-chain service which files CSEA reports with the NCA. The principal alone exports nothing: every filing additionally needs a signed, report-scoped token from a vault reviewer. Registering also delivers the OC public key to the storage buckets. Blank unregisters and disables automated filing.",
            "authorityReporter",
            proposeSetAuthorityReporter,
            proposedAuthorityReporterView,
            currentAuthorityReporterView,
        )}

        {@render dualSetting(
            "Vault reviewers",
            "Grants access to quarantined material. Comma-separated user ids; replaces the whole set; each must already be a platform moderator. An empty list revokes all reviewers.",
            "vaultReviewers",
            proposeSetVaultReviewers,
            proposedVaultReviewersView,
            currentVaultReviewersView,
        )}

        {@render dualSetting(
            "Internal moderation channel",
            "Where moderation alerts - including report excerpts and context - are posted.",
            "moderationChannel",
            proposeSetInternalModerationChannel,
            proposedModerationChannelView,
            currentModerationChannelView,
        )}

        {@render dualSetting(
            "Destroy vaulted evidence",
            "Law enforcement destruction request. Irreversible: the blobs are removed even if a message still references them. A standing legal hold blocks destruction - clear the hold first, as a separate act. The reference and both operator identities are recorded in the vault log, which survives the destruction. ",
            "destroyEvidence",
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

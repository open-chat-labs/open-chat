<!-- The operator console's Operator functions tab (the old `OperatorFunctions`): the platform
     settings an operator sets at once, the daily puzzle's levers, pausing the event loop, and the
     danger zone's dual authorized settings, which only propose a change for a different operator
     to confirm (Pending operator proposals). The same forms, in the same order, as the old one.
     TODO(design): no design; plain cards and fields, and the library's buttons and toggles. -->
<script lang="ts">
    import { BRIDGE_PLATFORM_NAMES, type ResourceKey } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Toggle from "@openchat/ui/src/lib/components/Toggle.svelte";
    import type { DailyPuzzleOperator } from "@src/logic/admin/dailyPuzzleOperator.svelte";
    import {
        BRIDGE_PLATFORMS,
        REFERRAL_CATEGORIES,
        type OperatorAction,
        type OperatorFunctions,
        type OperatorOutcome,
    } from "@src/logic/admin/operatorFunctions.svelte";
    import type { RegenerateOption } from "@src/utils/dailyPuzzleOperator";
    import { onMount, type Snippet } from "svelte";
    import type { ConsoleReport } from "./console";
    import DailyPuzzleSection from "./DailyPuzzleSection.svelte";

    interface Props {
        ops: OperatorFunctions;
        puzzle: DailyPuzzleOperator;
        regenerateOptions: RegenerateOption[];
        translate: (key: ResourceKey) => string;
        onPauseEventLoop: () => void;
        onResumeEventLoop: () => void;
        onReport: ConsoleReport;
    }

    let {
        ops,
        puzzle,
        regenerateOptions,
        translate,
        onPauseEventLoop,
        onResumeEventLoop,
        onReport,
    }: Props = $props();

    onMount(() => ops.load());

    async function run(action: () => Promise<OperatorOutcome | undefined>): Promise<void> {
        onReport(await action());
    }

    const value = (e: Event & { currentTarget: HTMLInputElement | HTMLSelectElement }) =>
        e.currentTarget.value;
</script>

{#snippet field(label: string, control: Snippet)}
    <label class="field">
        <span class="admin-label">{label}</span>
        {@render control()}
    </label>
{/snippet}

{#snippet apply(
    label: string,
    action: OperatorAction,
    onClick: () => Promise<void>,
    disabled: boolean = false,
    variant: "primary" | "secondary" = "primary",
)}
    <span class="button">
        <Button
            {label}
            {variant}
            busy={ops.busy.has(action)}
            disabled={ops.busy.has(action) || disabled}
            onClick={() => void onClick()} />
    </span>
{/snippet}

{#snippet dualSetting(
    name: string,
    desc: string,
    action: OperatorAction,
    onPropose: () => Promise<OperatorOutcome>,
    proposed: Snippet,
    current?: Snippet,
)}
    <section class="admin-card">
        <h3 class="admin-card-title">{name}</h3>
        <p class="admin-hint">{desc}</p>
        {#if current}
            <div class="compare">
                <div class="column">
                    <span class="admin-label">Current</span>
                    {@render current()}
                </div>
                <div class="column">
                    <span class="admin-label">Proposed</span>
                    {@render proposed()}
                </div>
            </div>
        {:else}
            {@render proposed()}
        {/if}
        <div class="actions">
            {@render apply("Propose", action, () => run(onPropose))}
        </div>
    </section>
{/snippet}

<div class="operator">
    <section class="admin-card">
        <h3 class="admin-card-title">Set group upgrade concurrency</h3>
        <div class="admin-row">
            <input
                class="admin-input"
                aria-label="Group upgrade concurrency"
                aria-invalid={ops.groupUpgradeConcurrencyInvalid}
                value={ops.groupUpgradeConcurrency}
                oninput={(e) => (ops.groupUpgradeConcurrency = value(e))} />
            {@render apply(
                "Apply",
                "groupUpgradeConcurrency",
                () => run(() => ops.setGroupUpgradeConcurrency()),
                ops.groupUpgradeConcurrencyInvalid,
            )}
        </div>
    </section>

    <section class="admin-card">
        <h3 class="admin-card-title">Set community upgrade concurrency</h3>
        <div class="admin-row">
            <input
                class="admin-input"
                aria-label="Community upgrade concurrency"
                aria-invalid={ops.communityUpgradeConcurrencyInvalid}
                value={ops.communityUpgradeConcurrency}
                oninput={(e) => (ops.communityUpgradeConcurrency = value(e))} />
            {@render apply(
                "Apply",
                "communityUpgradeConcurrency",
                () => run(() => ops.setCommunityUpgradeConcurrency()),
                ops.communityUpgradeConcurrencyInvalid,
            )}
        </div>
    </section>

    <section class="admin-card">
        <h3 class="admin-card-title">Create MultiUser canister</h3>
        <div class="admin-row">
            <input
                class="admin-input"
                placeholder="LocalUserIndex canister id"
                aria-invalid={ops.multiUserCanisterLocalUserIndexInvalid}
                value={ops.multiUserCanisterLocalUserIndex}
                oninput={(e) => (ops.multiUserCanisterLocalUserIndex = value(e))} />
            {@render apply(
                "Create",
                "multiUserCanister",
                () => run(() => ops.createMultiUserCanister()),
                ops.multiUserCanisterLocalUserIndexInvalid,
            )}
        </div>
    </section>

    {#if ops.currentFees !== undefined}
        {@const fees = ops.currentFees[ops.feesTab]}
        <section class="admin-card">
            <h3 class="admin-card-title">Set Diamond membership fees</h3>
            {#snippet token()}
                <select
                    class="admin-input"
                    value={ops.feesTab}
                    onchange={(e) => (ops.feesTab = value(e) === "CHAT" ? "CHAT" : "ICP")}>
                    <option value="ICP">ICP</option>
                    <option value="CHAT">CHAT</option>
                </select>
            {/snippet}
            {@render field("Token", token)}
            {#snippet oneMonth()}
                <input class="admin-input" value={fees.oneMonth} oninput={(e) => (fees.oneMonth = value(e))} />
            {/snippet}
            {@render field("One month", oneMonth)}
            {#snippet threeMonths()}
                <input
                    class="admin-input"
                    value={fees.threeMonths}
                    oninput={(e) => (fees.threeMonths = value(e))} />
            {/snippet}
            {@render field("Three month", threeMonths)}
            {#snippet oneYear()}
                <input class="admin-input" value={fees.oneYear} oninput={(e) => (fees.oneYear = value(e))} />
            {/snippet}
            {@render field("One year", oneYear)}
            {#snippet lifetime()}
                <input class="admin-input" value={fees.lifetime} oninput={(e) => (fees.lifetime = value(e))} />
            {/snippet}
            {@render field("Lifetime", lifetime)}
            <div class="actions">
                {@render apply("Apply", "diamondFees", () => run(() => ops.setDiamondMembershipFees()))}
            </div>
        </section>
    {/if}

    <section class="admin-card">
        <h3 class="admin-card-title">Stake neuron for submitting proposals</h3>
        {#snippet governance()}
            <input
                class="admin-input"
                value={ops.governanceCanisterId}
                oninput={(e) => (ops.governanceCanisterId = value(e))} />
        {/snippet}
        {@render field("Governance Canister Id", governance)}
        {#snippet stake()}
            <input class="admin-input" value={ops.stake} oninput={(e) => (ops.stake = value(e))} />
        {/snippet}
        {@render field("Stake", stake)}
        <div class="actions">
            {@render apply("Apply", "stakeNeuron", () =>
                run(() => ops.stakeNeuronForSubmittingProposals()),
            )}
        </div>
    </section>

    <section class="admin-card">
        <h3 class="admin-card-title">Set token enabled</h3>
        <div class="admin-row">
            <input
                class="admin-input"
                aria-label="Token ledger"
                aria-invalid={!ops.tokenLedgerValid}
                value={ops.tokenLedger}
                oninput={(e) => (ops.tokenLedger = value(e))} />
            <Toggle
                on={ops.tokenEnabled}
                ariaLabel="Token enabled"
                onChange={(on) => (ops.tokenEnabled = on)} />
            {@render apply(
                "Apply",
                "tokenEnabled",
                () => run(() => ops.setTokenEnabled()),
                !ops.tokenLedgerValid,
            )}
        </div>
    </section>

    <section class="admin-card">
        <h3 class="admin-card-title">Set moderation referral config</h3>
        <p class="admin-hint">
            Per-category score thresholds (0-1) above which a message is referred for human moderator
            review. Leave a category blank to disable it. All blank = referral disabled.
        </p>
        {#each REFERRAL_CATEGORIES as [bit, name] (bit)}
            {#snippet threshold()}
                <input
                    class="admin-input"
                    placeholder="disabled"
                    value={ops.referralThreshold(bit)}
                    oninput={(e) => ops.setReferralThreshold(bit, value(e))} />
            {/snippet}
            {@render field(name, threshold)}
        {/each}
        <div class="actions">
            {@render apply(
                "Apply",
                "referralConfig",
                () => run(() => ops.setModerationReferralConfig()),
                ops.referralThresholdsInvalid,
            )}
        </div>
    </section>

    <section class="admin-card">
        <h3 class="admin-card-title">Vault legal hold</h3>
        <p class="admin-hint">
            Suspends the retention clock so evidence outlasts the ordinary retention period. Clearing
            a hold on evidence whose release is already pending performs that release and destroys
            it, so that one case is proposed for a second operator to confirm.
        </p>
        <p class="admin-hint">
            Preservation request: suspends the retention clock for a report's vaulted evidence, so it
            is never deleted at expiry. Clearing the hold performs any release which was deferred
            while it was set.
        </p>
        {#snippet holdIndex()}
            <input
                class="admin-input"
                value={ops.legalHoldReportIndex}
                oninput={(e) => (ops.legalHoldReportIndex = value(e))} />
        {/snippet}
        {@render field("Report index", holdIndex)}
        {#snippet holdReference()}
            <input
                class="admin-input"
                value={ops.legalHoldReference}
                oninput={(e) => (ops.legalHoldReference = value(e))} />
        {/snippet}
        {@render field("Request reference", holdReference)}
        <div class="actions">
            {@render apply("Set hold", "legalHold", () => run(() => ops.setVaultLegalHold(true)))}
            {@render apply(
                "Clear hold",
                "legalHold",
                () => run(() => ops.setVaultLegalHold(false)),
                false,
                "secondary",
            )}
        </div>
    </section>

    <section class="admin-card">
        <h3 class="admin-card-title">Native call push</h3>
        <Toggle
            on={ops.callPushEnabled}
            label="Enabled"
            onChange={(on) => (ops.callPushEnabled = on)} />
        <div class="actions">
            {@render apply("Apply", "callPush", () => run(() => ops.applyCallPush()))}
        </div>
    </section>

    <section class="admin-card">
        <h3 class="admin-card-title">Alchemy API key (Solana RPC)</h3>
        <input
            class="admin-input"
            placeholder="New key"
            value={ops.alchemyApiKey}
            oninput={(e) => (ops.alchemyApiKey = value(e))} />
        <div class="actions">
            {@render apply(
                "Set",
                "alchemyKey",
                () => run(() => ops.setAlchemyApiKey(ops.alchemyApiKey.trim())),
                ops.alchemyApiKey.trim() === "",
            )}
            {@render apply(
                "Unset",
                "alchemyKey",
                () => run(() => ops.setAlchemyApiKey(undefined)),
                false,
                "secondary",
            )}
        </div>
    </section>

    <section class="admin-card">
        <h3 class="admin-card-title">MiniApp service principal</h3>
        <input
            class="admin-input"
            placeholder="Service principal"
            value={ops.miniAppServicePrincipal}
            oninput={(e) => (ops.miniAppServicePrincipal = value(e))} />
        <div class="actions">
            {@render apply(
                "Set",
                "miniAppPrincipal",
                () => run(() => ops.setMiniAppServicePrincipal()),
                ops.miniAppServicePrincipal.trim() === "",
            )}
        </div>
    </section>

    {#each BRIDGE_PLATFORMS as platform (platform)}
        <section class="admin-card">
            <h3 class="admin-card-title">{BRIDGE_PLATFORM_NAMES[platform]} bridge bot</h3>
            <input
                class="admin-input"
                placeholder="Bot id"
                value={ops.bridgeBotIds[platform]}
                oninput={(e) => (ops.bridgeBotIds[platform] = value(e))} />
            <div class="actions">
                {@render apply(
                    "Set",
                    "bridgeBot",
                    () => run(() => ops.setBridgeBot(platform, ops.bridgeBotIds[platform].trim())),
                    ops.bridgeBotIds[platform].trim() === "",
                )}
                {@render apply(
                    "Unset",
                    "bridgeBot",
                    () => run(() => ops.setBridgeBot(platform, undefined)),
                    false,
                    "secondary",
                )}
            </div>
        </section>
    {/each}

    <section class="admin-card">
        <div class="admin-row">
            <h3 class="admin-card-title admin-grow">Pause event loop</h3>
            <Button label="Pause" variant="secondary" onClick={onPauseEventLoop} />
        </div>
    </section>

    <section class="admin-card">
        <div class="admin-row">
            <h3 class="admin-card-title admin-grow">Resume event loop</h3>
            <Button label="Resume" variant="secondary" onClick={onResumeEventLoop} />
        </div>
    </section>

    <DailyPuzzleSection {puzzle} {regenerateOptions} {translate} {onReport} />

    <section class="danger">
        <h2 class="danger-title">Danger Zone</h2>
        <h3 class="admin-card-title">Dual auth operator actions</h3>
        <p class="admin-hint">
            Everything below is <strong>dual authorized</strong>: you propose the change, and a
            different platform operator confirms or rejects it. Nothing here takes effect when you
            press Propose. Pending proposals - yours and other operators' - are listed under the
            <strong>Pending proposals</strong> tab.
        </p>

        {#snippet currentOpenAIKey()}
            <input class="admin-input" disabled value={ops.openAiKeySet ? "Set" : "Not set"} />
        {/snippet}
        {#snippet proposedOpenAIKey()}
            <input
                class="admin-input"
                placeholder="New key (blank to unset)"
                value={ops.openAiApiKey}
                oninput={(e) => (ops.openAiApiKey = value(e))} />
        {/snippet}
        {@render dualSetting(
            "OpenAI API key (moderation)",
            "Arms the classification pipeline on every local user index. Setting it starts proactive detection and the reporting duties which follow from it.",
            "openAiKey",
            () => ops.proposeSetOpenAIApiKey(),
            proposedOpenAIKey,
            currentOpenAIKey,
        )}

        {#snippet currentMediaScan()}
            <input
                class="admin-input"
                disabled
                value={ops.currentMediaScan || "Disabled (no scanners)"} />
        {/snippet}
        {#snippet proposedMediaScan()}
            <Toggle
                on={ops.mediaScanEnabled}
                ariaLabel="Media scanning enabled"
                onChange={(on) => (ops.mediaScanEnabled = on)} />
            <input
                class="admin-input"
                placeholder="Comma separated scanner principals"
                value={ops.mediaScanScanners}
                oninput={(e) => (ops.mediaScanScanners = value(e))} />
        {/snippet}
        {@render dualSetting(
            "Media scanning (known-CSAM hash matching)",
            "Arms the media scan pipeline on every local user index and registers the worker principals allowed to collect scan jobs and submit verdicts. The toggle is the kill switch: while disabled, scan requests are dropped. Enabling requires at least one scanner principal.",
            "mediaScan",
            () => ops.proposeSetMediaScanConfig(),
            proposedMediaScan,
            currentMediaScan,
        )}

        {#snippet currentAuthorityReporter()}
            <input class="admin-input" disabled value={ops.currentAuthorityReporter || "None"} />
        {/snippet}
        {#snippet proposedAuthorityReporter()}
            <input
                class="admin-input"
                placeholder="Service principal (blank to unregister)"
                value={ops.authorityReporter}
                oninput={(e) => (ops.authorityReporter = value(e))} />
        {/snippet}
        {@render dualSetting(
            "NCA reporting service (authority reporter)",
            "Registers the principal of the off-chain service which files CSEA reports with the NCA. The principal alone exports nothing: every filing additionally needs a signed, report-scoped token from a vault reviewer. Registering also delivers the OC public key to the storage buckets. Blank unregisters and disables automated filing.",
            "authorityReporter",
            () => ops.proposeSetAuthorityReporter(),
            proposedAuthorityReporter,
            currentAuthorityReporter,
        )}

        {#snippet currentVaultReviewers()}
            <input class="admin-input" disabled value={ops.currentVaultReviewers || "None"} />
        {/snippet}
        {#snippet proposedVaultReviewers()}
            <input
                class="admin-input"
                placeholder="Comma separated reviewer Ids"
                value={ops.vaultReviewerIds}
                oninput={(e) => (ops.vaultReviewerIds = value(e))} />
        {/snippet}
        {@render dualSetting(
            "Vault reviewers",
            "Grants access to quarantined material. Comma-separated user ids; replaces the whole set; each must already be a platform moderator. An empty list revokes all reviewers.",
            "vaultReviewers",
            () => ops.proposeSetVaultReviewers(),
            proposedVaultReviewers,
            currentVaultReviewers,
        )}

        {#snippet currentModerationChannel()}
            <input class="admin-input" disabled value={ops.currentModerationChannel || "Not set"} />
        {/snippet}
        {#snippet proposedModerationChannel()}
            <input
                class="admin-input"
                placeholder="Community id"
                value={ops.moderationCommunityId}
                oninput={(e) => (ops.moderationCommunityId = value(e))} />
            <input
                class="admin-input"
                placeholder="Channel id"
                value={ops.moderationChannelId}
                oninput={(e) => (ops.moderationChannelId = value(e))} />
        {/snippet}
        {@render dualSetting(
            "Internal moderation channel",
            "Where moderation alerts - including report excerpts and context - are posted.",
            "moderationChannel",
            () => ops.proposeSetInternalModerationChannel(),
            proposedModerationChannel,
            currentModerationChannel,
        )}

        {#snippet proposedDestroy()}
            {#snippet destroyIndex()}
                <input
                    class="admin-input"
                    value={ops.destroyReportIndex}
                    oninput={(e) => (ops.destroyReportIndex = value(e))} />
            {/snippet}
            {@render field("Report index", destroyIndex)}
            {#snippet destroyRef()}
                <input
                    class="admin-input"
                    value={ops.destroyRequestRef}
                    oninput={(e) => (ops.destroyRequestRef = value(e))} />
            {/snippet}
            {@render field("LE request reference", destroyRef)}
        {/snippet}
        {@render dualSetting(
            "Destroy vaulted evidence",
            "Law enforcement destruction request. Irreversible: the blobs are removed even if a message still references them. A standing legal hold blocks destruction - clear the hold first, as a separate act. The reference and both operator identities are recorded in the vault log, which survives the destruction. ",
            "destroyEvidence",
            () => ops.proposeDestroyVaultEvidence(),
            proposedDestroy,
        )}
    </section>

    {#if ops.error}
        <p class="admin-error" role="alert">{translate(ops.error)}</p>
    {/if}
</div>

<style lang="scss">
    .operator {
        display: flex;
        flex-direction: column;
        gap: var(--space-16);
        max-width: 640px;
    }

    .field {
        display: grid;
        grid-template-columns: 160px 1fr;
        align-items: center;
        gap: var(--space-10);
    }

    .button {
        display: flex;
        flex: none;
    }

    .actions {
        display: flex;
        gap: var(--space-8);
    }

    .compare {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-16);
    }

    .column {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        min-width: 0;
    }

    .danger {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: var(--space-16);
        border-radius: var(--radius-lg);
        background: var(--status-danger-soft);
        box-shadow: inset 0 0 0 1px var(--status-danger-line);
    }

    .danger-title {
        margin: 0;
        font: var(--weight-bold) var(--text-xl) / 1.3 var(--font-sans);
        color: var(--ink);
    }
</style>

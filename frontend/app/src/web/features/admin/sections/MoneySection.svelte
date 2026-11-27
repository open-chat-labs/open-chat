<!-- Money and fees: the Diamond membership prices (ICP or CHAT, each period in e8s with what it
     comes to under it; shown once they're read), staking the neuron for submitting proposals, and
     enabling or disabling a token. Each a settings card with its last outcome. -->
<script lang="ts">
    import type { ResourceKey } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import SegmentedTabs from "@openchat/ui/src/lib/components/SegmentedTabs.svelte";
    import SettingsCard from "@openchat/ui/src/lib/components/SettingsCard.svelte";
    import TextInput from "@openchat/ui/src/lib/components/TextInput.svelte";
    import Toggle from "@openchat/ui/src/lib/components/Toggle.svelte";
    import { e8sAmount, principalProblem, wholeNumberProblem } from "@src/logic/admin/fieldChecks";
    import type { FeesForm } from "@src/logic/admin/operatorFunctions.svelte";
    import type { AdminConsole } from "../adminConsole.svelte";

    interface Props {
        admin: AdminConsole;
        translate: (key: ResourceKey) => string;
    }

    let { admin, translate }: Props = $props();

    const ops = $derived(admin.ops);

    const out = (form: string, busy: boolean) => admin.cardOutcome(form, busy, translate);

    const TOKENS = ["ICP", "CHAT"] as const;
    const PERIODS: { key: keyof Omit<FeesForm, "token">; label: string }[] = [
        { key: "oneMonth", label: "One month" },
        { key: "threeMonths", label: "Three months" },
        { key: "oneYear", label: "One year" },
        { key: "lifetime", label: "Lifetime" },
    ];

    const feesInvalid = $derived(
        ops.currentFees === undefined ||
            TOKENS.some((token) =>
                PERIODS.some(
                    (p) => wholeNumberProblem(ops.currentFees?.[token][p.key] ?? "") !== undefined,
                ),
            ),
    );
</script>

<SettingsCard
    title="Diamond membership fees"
    help="The price of each membership period, in e8s of the token it’s paid in."
    icon="diamond"
    cols={2}
    outcome={out("fees", ops.busy.has("diamondFees"))}>
    {#if ops.currentFees === undefined}
        <p class="loading">Reading the fees…</p>
    {:else}
        {@const fees = ops.currentFees[ops.feesTab]}
        <div class="token">
            <SegmentedTabs
                labels={[...TOKENS]}
                selectedIndex={TOKENS.indexOf(ops.feesTab)}
                dotIndexes={[]}
                onSelect={(i) => (ops.feesTab = TOKENS[i] ?? "ICP")} />
        </div>
        {#each PERIODS as period (period.key)}
            <TextInput
                value={fees[period.key]}
                label={period.label}
                placeholder="0"
                inputmode="numeric"
                unit="e8s"
                mono
                error={wholeNumberProblem(fees[period.key])}
                help={e8sAmount(fees[period.key], ops.feesTab) === undefined ? "" : "Comes to"}
                note={e8sAmount(fees[period.key], ops.feesTab) ?? ""}
                onInput={(v) => (fees[period.key] = v)} />
        {/each}
    {/if}
    {#snippet actions()}
        <Button
            label="Apply"
            busy={ops.busy.has("diamondFees")}
            disabled={ops.busy.has("diamondFees") || feesInvalid}
            onClick={() => void admin.run("fees", () => ops.setDiamondMembershipFees())} />
    {/snippet}
</SettingsCard>

<SettingsCard
    title="Stake neuron for submitting proposals"
    help="Stakes a neuron with an SNS governance canister, for OpenChat to submit proposals with."
    icon="coins"
    cols={2}
    outcome={out("stake", ops.busy.has("stakeNeuron"))}>
    <TextInput
        value={ops.governanceCanisterId}
        placeholder="Governance canister id"
        mono
        paste
        error={principalProblem(ops.governanceCanisterId)}
        onInput={(v) => (ops.governanceCanisterId = v)} />
    <TextInput
        value={ops.stake}
        placeholder="Stake"
        inputmode="numeric"
        unit="e8s"
        mono
        error={wholeNumberProblem(ops.stake)}
        onInput={(v) => (ops.stake = v)} />
    {#snippet actions()}
        <Button
            label="Stake"
            busy={ops.busy.has("stakeNeuron")}
            disabled={ops.busy.has("stakeNeuron") ||
                ops.governanceCanisterId.trim() === "" ||
                principalProblem(ops.governanceCanisterId) !== undefined ||
                wholeNumberProblem(ops.stake) !== undefined}
            onClick={() =>
                void admin.run("stake", () => ops.stakeNeuronForSubmittingProposals())} />
    {/snippet}
</SettingsCard>

<SettingsCard
    title="Token enabled"
    help="Turns a token on or off across OpenChat, by its ledger canister id."
    icon="coins"
    outcome={out("token", ops.busy.has("tokenEnabled"))}>
    <div class="token-row">
        <TextInput
            value={ops.tokenLedger}
            placeholder="Token ledger canister id"
            mono
            paste
            error={principalProblem(ops.tokenLedger)}
            onInput={(v) => (ops.tokenLedger = v)} />
        <Toggle
            on={ops.tokenEnabled}
            label={ops.tokenEnabled ? "Enabled" : "Disabled"}
            onChange={(on) => (ops.tokenEnabled = on)} />
    </div>
    {#snippet actions()}
        <Button
            label="Apply"
            busy={ops.busy.has("tokenEnabled")}
            disabled={ops.busy.has("tokenEnabled") || !ops.tokenLedgerValid}
            onClick={() => void admin.run("token", () => ops.setTokenEnabled())} />
    {/snippet}
</SettingsCard>

<style lang="scss">
    .token {
        grid-column: 1 / -1;
        max-width: 280px;
    }

    .loading {
        grid-column: 1 / -1;
        margin: 0;
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--ink-3);
    }

    .token-row {
        display: flex;
        align-items: flex-start;
        gap: var(--space-14);

        > :global(:first-child) {
            flex: 1;
            min-width: 0;
        }

        > :global(:last-child) {
            flex: none;
            padding-top: var(--space-10);
        }
    }
</style>

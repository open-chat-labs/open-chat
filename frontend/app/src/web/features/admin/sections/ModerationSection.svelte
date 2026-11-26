<!-- Moderation: the referral thresholds (one per category, labelled, in two columns; blank turns a
     category off) and legal holds on a report's vaulted evidence. Clearing a hold asks first: it
     performs any release deferred while it was set, and when that release is already pending it
     becomes a proposal for another operator (the footer then says "proposed"). -->
<script lang="ts">
    import type { ResourceKey } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import ConfirmDialog from "@openchat/ui/src/lib/components/ConfirmDialog.svelte";
    import SettingsCard from "@openchat/ui/src/lib/components/SettingsCard.svelte";
    import TextInput from "@openchat/ui/src/lib/components/TextInput.svelte";
    import { thresholdProblem, wholeNumberProblem } from "@src/logic/admin/fieldChecks";
    import { REFERRAL_CATEGORIES } from "@src/logic/admin/operatorFunctions.svelte";
    import { onMount } from "svelte";
    import type { AdminConsole } from "../adminConsole.svelte";

    interface Props {
        admin: AdminConsole;
        translate: (key: ResourceKey) => string;
    }

    let { admin, translate }: Props = $props();

    const ops = $derived(admin.ops);
    onMount(() => admin.loadOperatorFunctions());

    const out = (form: string, busy: boolean) => admin.cardOutcome(form, busy, translate);

    const holdReady = $derived(
        ops.legalHoldReportIndex.trim() !== "" &&
            wholeNumberProblem(ops.legalHoldReportIndex) === undefined &&
            ops.legalHoldReference.trim() !== "",
    );
    let clearing = $state(false);

    async function clearHold(): Promise<void> {
        await admin.outcomes.run("legalHold", () => ops.setVaultLegalHold(false));
        clearing = false;
    }
</script>

<SettingsCard
    title="Moderation referral config"
    help="A score threshold from 0 to 1 for each category, above which a message is referred for human review. Leave a category blank to turn it off; leave them all blank to turn referral off."
    icon="flag"
    cols={2}
    outcome={out("referral", ops.busy.has("referralConfig"))}>
    {#each REFERRAL_CATEGORIES as [bit, name] (bit)}
        <TextInput
            value={ops.referralThreshold(bit)}
            label={name}
            aside={ops.referralThreshold(bit).trim() === "" ? "Off" : ""}
            placeholder="Off"
            inputmode="decimal"
            mono
            error={thresholdProblem(ops.referralThreshold(bit))}
            onInput={(v) => ops.setReferralThreshold(bit, v)} />
    {/each}
    {#snippet actions()}
        <Button
            label="Apply"
            busy={ops.busy.has("referralConfig")}
            disabled={ops.busy.has("referralConfig") || ops.referralThresholdsInvalid}
            onClick={() =>
                void admin.outcomes.run("referral", () => ops.setModerationReferralConfig())} />
    {/snippet}
</SettingsCard>

<SettingsCard
    title="Vault legal hold"
    help="A preservation request: suspends the retention clock for a report’s vaulted evidence, so it outlasts the ordinary retention period. Clearing the hold performs any release deferred while it was set; if that release is already pending, clearing is proposed for a second operator to confirm."
    icon="lock"
    cols={2}
    outcome={out("legalHold", ops.busy.has("legalHold"))}>
    <TextInput
        value={ops.legalHoldReportIndex}
        placeholder="Report index"
        inputmode="numeric"
        mono
        error={wholeNumberProblem(ops.legalHoldReportIndex)}
        onInput={(v) => (ops.legalHoldReportIndex = v)} />
    <TextInput
        value={ops.legalHoldReference}
        placeholder="Request reference"
        mono
        onInput={(v) => (ops.legalHoldReference = v)} />
    {#snippet actions()}
        <Button
            label="Clear hold"
            variant="secondary"
            disabled={ops.busy.has("legalHold") || !holdReady}
            onClick={() => (clearing = true)} />
        <Button
            label="Set hold"
            busy={ops.busy.has("legalHold") && !clearing}
            disabled={ops.busy.has("legalHold") || !holdReady}
            onClick={() =>
                void admin.outcomes.run("legalHold", () => ops.setVaultLegalHold(true))} />
    {/snippet}
</SettingsCard>

{#if clearing}
    <ConfirmDialog
        title="Clear the legal hold?"
        body="Any release deferred while the hold was set happens now, which can destroy the evidence. If that release is already pending, this is proposed for a second operator to confirm instead."
        facts={[
            { label: "Report index", value: ops.legalHoldReportIndex.trim() },
            { label: "Request reference", value: ops.legalHoldReference.trim() },
        ]}
        confirmLabel="Clear hold"
        busy={ops.busy.has("legalHold")}
        onConfirm={() => void clearHold()}
        onClose={() => (clearing = false)} />
{/if}

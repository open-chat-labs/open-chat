<!-- Danger zone: the dual-authorised settings. A banner says nothing here applies when proposed
     (You propose → another operator confirms → it applies) and how many proposals are pending,
     linking to them. Each setting is a card showing the value now beside the field for the
     proposed one (CompareRow), with Propose; its footer then says "proposed", never a success.
     Destroying vaulted evidence is a destructive card whose Propose asks for the report index to
     be typed. -->
<script lang="ts">
    import type { ResourceKey } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import CompareRow from "@openchat/ui/src/lib/components/CompareRow.svelte";
    import ConfirmDialog from "@openchat/ui/src/lib/components/ConfirmDialog.svelte";
    import SettingsCard from "@openchat/ui/src/lib/components/SettingsCard.svelte";
    import StepIndicator from "@openchat/ui/src/lib/components/StepIndicator.svelte";
    import TextInput from "@openchat/ui/src/lib/components/TextInput.svelte";
    import Toggle from "@openchat/ui/src/lib/components/Toggle.svelte";
    import { adminSectionPath } from "@src/logic/admin/adminSections";
    import { principalProblem, wholeNumberProblem } from "@src/logic/admin/fieldChecks";
    import type {
        OperatorAction,
        OperatorOutcome,
    } from "@src/logic/admin/operatorFunctions.svelte";
    import { navigate } from "@src/utils/navigation";
    import { onMount } from "svelte";
    import type { AdminConsole } from "../adminConsole.svelte";

    interface Props {
        admin: AdminConsole;
        translate: (key: ResourceKey) => string;
    }

    let { admin, translate }: Props = $props();

    const ops = $derived(admin.ops);
    onMount(() => admin.loadOperatorFunctions());

    const out = (form: OperatorAction) =>
        admin.cardOutcome(form, ops.busy.has(form), translate, "Proposing…");
    const propose = (form: OperatorAction, action: () => Promise<OperatorOutcome>) =>
        void admin.outcomes.run(form, action, true);

    const pending = $derived(admin.proposals.pending.length);

    const destroyReady = $derived(
        ops.destroyReportIndex.trim() !== "" &&
            wholeNumberProblem(ops.destroyReportIndex) === undefined &&
            ops.destroyRequestRef.trim() !== "",
    );
    let destroying = $state(false);

    async function proposeDestroy(): Promise<void> {
        await admin.outcomes.run("destroyEvidence", () => ops.proposeDestroyVaultEvidence(), true);
        destroying = false;
    }
</script>

<div class="intro">
    <div class="intro-top">
        <span class="intro-tile" aria-hidden="true"></span>
        <div class="intro-text">
            <span class="intro-title">Nothing here applies when you propose it</span>
            <span class="intro-help">
                Each change waits under Pending proposals until a different platform operator
                confirms it. Anyone can reject it, and it expires after 14 days.
            </span>
        </div>
        {#if pending > 0}
            <Button
                label={`${pending} pending`}
                variant="secondary"
                onClick={() => navigate(adminSectionPath("proposals"))} />
        {/if}
    </div>
    <StepIndicator steps={["You propose", "Another operator confirms", "It applies"]} current={0} />
</div>

<SettingsCard
    title="OpenAI API key (moderation)"
    help="Arms the classification pipeline on every local user index. Setting it starts proactive detection and the reporting duties which follow from it."
    icon="key"
    tone="danger"
    dual
    outcome={out("openAiKey")}>
    <CompareRow current={ops.openAiKeySet ? "Set" : ""} label="Current OpenAI API key">
        <TextInput
            value={ops.openAiApiKey}
            placeholder="New key (blank to unset)"
            type="password"
            mono
            onInput={(v) => (ops.openAiApiKey = v)} />
    </CompareRow>
    {#snippet actions()}
        <Button
            label="Propose"
            busy={ops.busy.has("openAiKey")}
            disabled={ops.busy.has("openAiKey")}
            onClick={() => propose("openAiKey", () => ops.proposeSetOpenAIApiKey())} />
    {/snippet}
</SettingsCard>

<SettingsCard
    title="Media scanning (known-CSAM hash matching)"
    help="Arms the media scan pipeline on every local user index and registers the worker principals allowed to collect scan jobs and submit verdicts. The switch is the kill switch: while it’s off, scan requests are dropped. Turning it on needs at least one scanner principal."
    icon="shield"
    tone="danger"
    dual
    outcome={out("mediaScan")}>
    <CompareRow
        current={ops.currentMediaScan}
        empty="Disabled (no scanners)"
        label="Current media scanning">
        <Toggle
            on={ops.mediaScanEnabled}
            label={ops.mediaScanEnabled ? "Enabled" : "Disabled"}
            onChange={(on) => (ops.mediaScanEnabled = on)} />
        <TextInput
            value={ops.mediaScanScanners}
            placeholder="Scanner principals, comma separated"
            mono
            error={principalProblem(ops.mediaScanScanners, true)}
            onInput={(v) => (ops.mediaScanScanners = v)} />
    </CompareRow>
    {#snippet actions()}
        <Button
            label="Propose"
            busy={ops.busy.has("mediaScan")}
            disabled={ops.busy.has("mediaScan") ||
                principalProblem(ops.mediaScanScanners, true) !== undefined}
            onClick={() => propose("mediaScan", () => ops.proposeSetMediaScanConfig())} />
    {/snippet}
</SettingsCard>

<SettingsCard
    title="NCA reporting service (authority reporter)"
    help="Registers the principal of the off-chain service which files CSEA reports with the NCA. The principal alone exports nothing: every filing also needs a signed, report-scoped token from a vault reviewer. Registering also delivers the OC public key to the storage buckets. Blank unregisters it and turns automated filing off."
    icon="flag"
    tone="danger"
    dual
    outcome={out("authorityReporter")}>
    <CompareRow
        current={ops.currentAuthorityReporter}
        empty="None"
        label="Current authority reporter">
        <TextInput
            value={ops.authorityReporter}
            placeholder="Service principal (blank to unregister)"
            mono
            paste
            error={principalProblem(ops.authorityReporter)}
            onInput={(v) => (ops.authorityReporter = v)} />
    </CompareRow>
    {#snippet actions()}
        <Button
            label="Propose"
            busy={ops.busy.has("authorityReporter")}
            disabled={ops.busy.has("authorityReporter") ||
                principalProblem(ops.authorityReporter) !== undefined}
            onClick={() => propose("authorityReporter", () => ops.proposeSetAuthorityReporter())} />
    {/snippet}
</SettingsCard>

<SettingsCard
    title="Vault reviewers"
    help="Grants access to quarantined material. Comma separated user ids, replacing the whole set; each must already be a platform moderator. An empty list revokes every reviewer."
    icon="users"
    tone="danger"
    dual
    outcome={out("vaultReviewers")}>
    <CompareRow current={ops.currentVaultReviewers} empty="None" label="Current vault reviewers">
        <TextInput
            value={ops.vaultReviewerIds}
            placeholder="Reviewer user ids, comma separated"
            mono
            error={principalProblem(ops.vaultReviewerIds, true)}
            onInput={(v) => (ops.vaultReviewerIds = v)} />
    </CompareRow>
    {#snippet actions()}
        <Button
            label="Propose"
            busy={ops.busy.has("vaultReviewers")}
            disabled={ops.busy.has("vaultReviewers") ||
                principalProblem(ops.vaultReviewerIds, true) !== undefined}
            onClick={() => propose("vaultReviewers", () => ops.proposeSetVaultReviewers())} />
    {/snippet}
</SettingsCard>

<SettingsCard
    title="Internal moderation channel"
    help="Where moderation alerts, with report excerpts and their context, are posted."
    icon="chat"
    tone="danger"
    dual
    outcome={out("moderationChannel")}>
    <CompareRow current={ops.currentModerationChannel} label="Current internal moderation channel">
        <TextInput
            value={ops.moderationCommunityId}
            placeholder="Community id"
            mono
            paste
            error={principalProblem(ops.moderationCommunityId)}
            onInput={(v) => (ops.moderationCommunityId = v)} />
        <TextInput
            value={ops.moderationChannelId}
            placeholder="Channel id"
            inputmode="numeric"
            mono
            error={wholeNumberProblem(ops.moderationChannelId)}
            onInput={(v) => (ops.moderationChannelId = v)} />
    </CompareRow>
    {#snippet actions()}
        <Button
            label="Propose"
            busy={ops.busy.has("moderationChannel")}
            disabled={ops.busy.has("moderationChannel")}
            onClick={() =>
                propose("moderationChannel", () => ops.proposeSetInternalModerationChannel())} />
    {/snippet}
</SettingsCard>

<SettingsCard
    title="Destroy vaulted evidence"
    help="A law enforcement destruction request. Irreversible: the blobs are removed even if a message still references them. A standing legal hold blocks destruction; clear the hold first, as a separate act. The reference and both operators are recorded in the vault log, which survives the destruction."
    icon="trash"
    tone="destructive"
    tag="Destructive"
    tagTone="danger"
    cols={2}
    outcome={out("destroyEvidence")}>
    <TextInput
        value={ops.destroyReportIndex}
        placeholder="Report index"
        inputmode="numeric"
        mono
        error={wholeNumberProblem(ops.destroyReportIndex)}
        onInput={(v) => (ops.destroyReportIndex = v)} />
    <TextInput
        value={ops.destroyRequestRef}
        placeholder="Law enforcement request reference"
        mono
        onInput={(v) => (ops.destroyRequestRef = v)} />
    {#snippet actions()}
        <Button
            label="Propose destruction…"
            variant="danger"
            busy={ops.busy.has("destroyEvidence")}
            disabled={ops.busy.has("destroyEvidence") || !destroyReady}
            onClick={() => (destroying = true)} />
    {/snippet}
</SettingsCard>

{#if destroying}
    <ConfirmDialog
        title="Propose destroying this evidence?"
        body="Once another operator confirms it, the vaulted evidence is removed for good. It can’t be undone."
        facts={[
            { label: "Report index", value: ops.destroyReportIndex.trim() },
            { label: "Request reference", value: ops.destroyRequestRef.trim() },
        ]}
        confirmWord={ops.destroyReportIndex.trim()}
        confirmLabel="Propose destruction"
        busy={ops.busy.has("destroyEvidence")}
        onConfirm={() => void proposeDestroy()}
        onClose={() => (destroying = false)} />
{/if}

<style lang="scss">
    .intro {
        display: flex;
        flex-direction: column;
        gap: var(--space-16);
        padding: var(--space-18);
        border-radius: var(--radius-lg);
        background: color-mix(in oklch, var(--status-danger) 7%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--status-danger) 30%, var(--line-1));
    }

    .intro-top {
        display: flex;
        align-items: flex-start;
        gap: var(--space-12);
    }

    .intro-tile {
        flex: none;
        width: 32px;
        height: 32px;
        border-radius: var(--radius-sm);
        background: color-mix(in oklch, var(--status-danger) 14%, transparent);
        position: relative;

        &::after {
            content: "";
            position: absolute;
            inset: 8px;
            background: var(--status-danger);
            mask: var(--icon-warning) center / contain no-repeat;
        }
    }

    .intro-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .intro-title {
        font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
        color: var(--ink);
    }

    .intro-help {
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }
</style>

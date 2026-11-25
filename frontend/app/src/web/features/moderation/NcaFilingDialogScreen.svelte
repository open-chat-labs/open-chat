<!-- Filing a moderation report with the NCA (CSEA-IRP), or recording a filing made on the portal
     by hand (L6c), from the report's card: the old FileAuthorityReport on the shared form
     (logic/moderation's NcaFilingForm). Automated filing, where the reporting service is
     configured: the moderator's priority, their contact details for the NCA, and out of hours for
     P1 and P2 an acknowledgement that they'll phone; once the service takes it the dialog closes
     and the card shows the filing under way. Recording a filing (platform operators): the portal
     reference, which the card then shows. An operator may switch between the two. A failure says
     so inline, for another try.
     TODO(design): the design has no NCA filing; DialogShell with the old dialog's words. -->
<script lang="ts">
    import { platformOperatorStore, type OpenChat } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import SegmentedTabs from "@openchat/ui/src/lib/components/SegmentedTabs.svelte";
    import Toggle from "@openchat/ui/src/lib/components/Toggle.svelte";
    import { NcaFilingForm } from "@src/logic/moderation/ncaFilingForm.svelte";
    import { NCA_PRIORITY_LABELS, ncaReporterUrl } from "@src/utils/ncaFiling";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "nca_filing" }>> = $props();

    const client = getContext<OpenChat>("client");
    // the dialog's own value, fixed for its life
    const { reportIndex, urgent, onFiled, onFilingStarted } = dialog;
    const form = new NcaFilingForm(client, reportIndex, urgent, ncaReporterUrl);

    async function submitManual() {
        const outcome = await form.submitManual();
        if (outcome?.kind === "filed") {
            onFiled(outcome.portalReference);
            onClose();
        }
    }

    async function submitAuto() {
        const outcome = await form.submitAuto();
        if (outcome?.kind === "started") {
            onFilingStarted();
            onClose();
        }
    }
</script>

{#snippet field(
    label: string,
    value: string,
    set: (value: string) => void,
    type: "text" | "tel" | "email" = "text",
)}
    <input
        class="input"
        {type}
        placeholder={label}
        aria-label={label}
        {value}
        oninput={(e) => set(e.currentTarget.value)} />
{/snippet}

<DialogShell
    title={$_(
        form.mode === "auto" ? "moderationReport.fileAutomatically" : "moderationReport.recordFiling",
    )}
    width={520}
    height="auto"
    {onClose}>
    <div class="filing">
        <p class="text" class:urgent>
            {$_(urgent ? "moderationReport.ncaDueUrgent" : "moderationReport.ncaDue")}
        </p>
        {#if form.autoAvailable && $platformOperatorStore}
            <SegmentedTabs
                labels={[$_("moderationReport.fileAutomatically"), $_("moderationReport.recordFiling")]}
                selectedIndex={form.mode === "auto" ? 0 : 1}
                dotOnLast={false}
                onSelect={(i) => (form.mode = i === 0 ? "auto" : "manual")} />
        {/if}
        {#if form.mode === "manual"}
            <p class="label">{$_("moderationReport.filingReference")}</p>
            {@render field(
                $_("moderationReport.filingReference"),
                form.reference,
                (v) => (form.reference = v),
            )}
        {:else}
            <p class="label">{$_("moderationReport.priority")}</p>
            <div class="priorities" role="radiogroup" aria-label={$_("moderationReport.priority")}>
                {#each NCA_PRIORITY_LABELS as [value, label] (value)}
                    <label class="priority">
                        <input
                            type="radio"
                            name="nca-priority"
                            checked={form.priority === value}
                            onchange={() => (form.priority = value)} />
                        <span class="text">{$_(label)}</span>
                    </label>
                {/each}
            </div>
            <p class="label">{$_("moderationReport.reporterContact")}</p>
            <div class="pair">
                {@render field(
                    $_("moderationReport.firstName"),
                    form.firstName,
                    (v) => (form.firstName = v),
                )}
                {@render field(
                    $_("moderationReport.lastName"),
                    form.lastName,
                    (v) => (form.lastName = v),
                )}
            </div>
            <div class="pair phone">
                {@render field(
                    $_("moderationReport.diallingCode"),
                    form.countryCallingCode,
                    (v) => (form.countryCallingCode = v),
                    "tel",
                )}
                {@render field(
                    $_("moderationReport.phone"),
                    form.phone,
                    (v) => (form.phone = v),
                    "tel",
                )}
            </div>
            {@render field(
                $_("moderationReport.email"),
                form.email,
                (v) => (form.email = v),
                "email",
            )}
            {#if form.needsOohAck}
                <div class="ooh">
                    <p class="text">{$_("moderationReport.oohWarning")}</p>
                    <Toggle
                        on={form.oohAcknowledged}
                        label={$_("moderationReport.oohAck")}
                        onChange={(on) => (form.oohAcknowledged = on)} />
                </div>
            {/if}
        {/if}
        {#if form.failed}
            <p class="text error" role="alert">
                {form.failureMessage ?? $_("moderationReport.failed")}
            </p>
        {/if}
    </div>
    <div class="actions">
        <Button label={$_("cancel")} variant="secondary" onClick={onClose} />
        {#if form.mode === "manual"}
            <Button
                label={$_("moderationReport.filingSubmit")}
                disabled={!form.manualValid}
                busy={form.busy}
                onClick={() => void submitManual()} />
        {:else}
            <Button
                label={$_("moderationReport.startFiling")}
                disabled={!form.autoValid}
                busy={form.busy}
                onClick={() => void submitAuto()} />
        {/if}
    </div>
</DialogShell>

<style lang="scss">
    .filing {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        min-width: 0;
        margin-bottom: var(--space-16);
    }

    .label {
        margin: var(--space-4) 0 0;
        font: var(--weight-medium) var(--text-xs) / 1.4 var(--font-sans);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-3);
    }

    .text {
        margin: 0;
        font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
        color: var(--ink-2);

        &.urgent,
        &.error {
            color: var(--status-danger);
        }

        &.urgent {
            font-weight: var(--weight-semibold);
        }
    }

    .priorities {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
    }

    .priority {
        display: flex;
        align-items: flex-start;
        gap: var(--space-8);
        cursor: pointer;

        input {
            margin: var(--space-4) 0 0;
            accent-color: var(--accent);
        }
    }

    .pair {
        display: flex;
        gap: var(--space-8);

        > :global(*) {
            flex: 1;
            min-width: 0;
        }

        &.phone > :global(:first-child) {
            flex: 0 0 30%;
        }
    }

    .input {
        box-sizing: border-box;
        width: 100%;
        padding: var(--space-10) var(--space-14);
        border: none;
        border-radius: var(--radius-md);
        background: var(--surface-2);
        box-shadow: inset 0 0 0 1px var(--line-2);
        color: var(--ink);
        font: var(--weight-regular) var(--text-base) / 1.4 var(--font-sans);

        &:focus-visible {
            outline: none;
            box-shadow: inset 0 0 0 1px var(--accent);
        }
    }

    .ooh {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: var(--space-12);
        border-radius: var(--radius-md);
        box-shadow: inset 0 0 0 1px var(--status-danger-line);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
    }
</style>

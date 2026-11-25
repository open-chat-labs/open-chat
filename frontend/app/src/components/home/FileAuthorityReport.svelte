<script lang="ts">
    import type { OpenChat } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { mobileWidth, platformOperatorStore } from "@client";
    import { NCA_PRIORITY_LABELS, ncaReporterUrl } from "../../utils/ncaFiling";
    import { NcaFilingForm } from "@src/logic/moderation/ncaFilingForm.svelte";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Checkbox from "../Checkbox.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Input from "../Input.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Radio from "../Radio.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        reportIndex: bigint;
        urgent: boolean;
        onFiled: (portalReference: string) => void;
        onFilingStarted?: () => void;
        onClose: () => void;
    }

    let { reportIndex, urgent, onFiled, onFilingStarted, onClose }: Props = $props();

    // The form's state and submits are logic/moderation's (ncaFilingForm), shared with the other
    // tree's dialog and the new web UI's
    const form = new NcaFilingForm(client, reportIndex, urgent, ncaReporterUrl);

    async function submitManual() {
        const outcome = await form.submitManual();
        if (outcome?.kind === "filed") onFiled(outcome.portalReference);
    }

    async function submitAuto() {
        const outcome = await form.submitAuto();
        if (outcome?.kind === "started") {
            onFilingStarted?.();
            onClose();
        }
    }
</script>

<Overlay {onClose} dismissible>
    <ModalContent {onClose}>
        {#snippet header()}
            <Translatable
                resourceKey={i18nKey(
                    form.mode === "auto"
                        ? "moderationReport.fileAutomatically"
                        : "moderationReport.recordFiling",
                )} />
        {/snippet}
        {#snippet body()}
            <div class="filing">
                <p>
                    <Translatable
                        resourceKey={i18nKey(
                            urgent ? "moderationReport.ncaDueUrgent" : "moderationReport.ncaDue",
                        )} />
                </p>
                {#if form.autoAvailable && $platformOperatorStore}
                    <div class="mode">
                        <Button
                            tiny
                            secondary={form.mode !== "auto"}
                            onClick={() => (form.mode = "auto")}>
                            <Translatable
                                resourceKey={i18nKey("moderationReport.fileAutomatically")} />
                        </Button>
                        <Button
                            tiny
                            secondary={form.mode !== "manual"}
                            onClick={() => (form.mode = "manual")}>
                            <Translatable resourceKey={i18nKey("moderationReport.recordFiling")} />
                        </Button>
                    </div>
                {/if}
                {#if form.mode === "manual"}
                    <Legend label={i18nKey("moderationReport.filingReference")} />
                    <Input bind:value={form.reference} />
                {:else}
                    <Legend label={i18nKey("moderationReport.priority")} />
                    {#each NCA_PRIORITY_LABELS as [value, label] (value)}
                        <Radio
                            id={`nca-priority-${value}`}
                            group="nca-priority"
                            checked={form.priority === value}
                            onChange={() => (form.priority = value)}
                            label={i18nKey(label)} />
                    {/each}
                    <Legend label={i18nKey("moderationReport.reporterContact")} />
                    <div class="contact-row">
                        <Input
                            bind:value={form.firstName}
                            placeholder={i18nKey("moderationReport.firstName")} />
                        <Input
                            bind:value={form.lastName}
                            placeholder={i18nKey("moderationReport.lastName")} />
                    </div>
                    <div class="contact-row">
                        <div class="dialling">
                            <Input
                                bind:value={form.countryCallingCode}
                                placeholder={i18nKey("moderationReport.diallingCode")} />
                        </div>
                        <Input
                            bind:value={form.phone}
                            placeholder={i18nKey("moderationReport.phone")} />
                    </div>
                    <Input bind:value={form.email} placeholder={i18nKey("moderationReport.email")} />
                    {#if form.needsOohAck}
                        <div class="ooh">
                            <p>
                                <Translatable
                                    resourceKey={i18nKey("moderationReport.oohWarning")} />
                            </p>
                            <Checkbox
                                id="ooh-ack"
                                small
                                label={i18nKey("moderationReport.oohAck")}
                                checked={form.oohAcknowledged}
                                onChange={() => (form.oohAcknowledged = !form.oohAcknowledged)} />
                        </div>
                    {/if}
                {/if}
                {#if form.failed}
                    <ErrorMessage>
                        {#if form.failureMessage !== undefined}
                            {form.failureMessage}
                        {:else}
                            <Translatable resourceKey={i18nKey("moderationReport.failed")} />
                        {/if}
                    </ErrorMessage>
                {/if}
            </div>
        {/snippet}
        {#snippet footer()}
            <ButtonGroup>
                <Button secondary small={!$mobileWidth} tiny={$mobileWidth} onClick={onClose}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </Button>
                {#if form.mode === "manual"}
                    <Button
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        disabled={form.busy || form.reference.trim() === ""}
                        loading={form.busy}
                        onClick={submitManual}>
                        <Translatable resourceKey={i18nKey("moderationReport.filingSubmit")} />
                    </Button>
                {:else}
                    <Button
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        disabled={form.busy || !form.autoValid}
                        loading={form.busy}
                        onClick={submitAuto}>
                        <Translatable resourceKey={i18nKey("moderationReport.startFiling")} />
                    </Button>
                {/if}
            </ButtonGroup>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .filing {
        display: flex;
        flex-direction: column;
        gap: $sp3;
    }
    .mode {
        display: flex;
        gap: $sp3;
    }
    .contact-row {
        display: flex;
        gap: $sp3;

        .dialling {
            flex: 0 0 30%;
        }
    }
    .ooh {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        padding: $sp3;
        border: 1px solid var(--error);
        border-radius: $sp2;
    }
</style>

<script lang="ts">
    import type { OpenChat } from "@client";
    import { platformOperatorStore } from "@client";
    import { Body, BodySmall, Button, Column, Input, Row, Sheet, Subtitle } from "component-lib";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { NCA_PRIORITY_LABELS, ncaReporterUrl } from "../../utils/ncaFiling";
    import { NcaFilingForm } from "@src/logic/moderation/ncaFilingForm.svelte";
    import Checkbox from "../../components/Checkbox.svelte";
    import Radio from "../../components/Radio.svelte";
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

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable
                resourceKey={i18nKey(
                    form.mode === "auto"
                        ? "moderationReport.fileAutomatically"
                        : "moderationReport.recordFiling",
                )} />
        </Subtitle>
        <Body>
            <Translatable
                resourceKey={i18nKey(
                    urgent ? "moderationReport.ncaDueUrgent" : "moderationReport.ncaDue",
                )} />
        </Body>
        {#if form.autoAvailable && $platformOperatorStore}
            <Row gap={"md"}>
                <Button secondary={form.mode !== "auto"} onClick={() => (form.mode = "auto")}>
                    <Translatable resourceKey={i18nKey("moderationReport.fileAutomatically")} />
                </Button>
                <Button secondary={form.mode !== "manual"} onClick={() => (form.mode = "manual")}>
                    <Translatable resourceKey={i18nKey("moderationReport.recordFiling")} />
                </Button>
            </Row>
        {/if}
        {#if form.mode === "manual"}
            <Input placeholder={$_("moderationReport.filingReference")} bind:value={form.reference} />
            {#if form.failed}
                <Body colour={"validationError"}>
                    <Translatable resourceKey={i18nKey("moderationReport.failed")} />
                </Body>
            {/if}
            <Button disabled={form.busy || form.reference.trim() === ""} loading={form.busy} onClick={submitManual}>
                <Translatable resourceKey={i18nKey("moderationReport.filingSubmit")} />
            </Button>
        {:else}
            <BodySmall colour={"textSecondary"} uppercase>
                <Translatable resourceKey={i18nKey("moderationReport.priority")} />
            </BodySmall>
            {#each NCA_PRIORITY_LABELS as [value, label] (value)}
                <Radio
                    id={`nca-priority-${value}`}
                    group="nca-priority"
                    checked={form.priority === value}
                    onChange={() => (form.priority = value)}
                    label={i18nKey(label)} />
            {/each}
            <BodySmall colour={"textSecondary"} uppercase>
                <Translatable resourceKey={i18nKey("moderationReport.reporterContact")} />
            </BodySmall>
            <Input placeholder={$_("moderationReport.firstName")} bind:value={form.firstName} />
            <Input placeholder={$_("moderationReport.lastName")} bind:value={form.lastName} />
            <Input
                placeholder={$_("moderationReport.diallingCode")}
                bind:value={form.countryCallingCode} />
            <Input placeholder={$_("moderationReport.phone")} bind:value={form.phone} />
            <Input placeholder={$_("moderationReport.email")} bind:value={form.email} />
            {#if form.needsOohAck}
                <Body colour={"validationError"}>
                    <Translatable resourceKey={i18nKey("moderationReport.oohWarning")} />
                </Body>
                <Checkbox
                    id="ooh-ack"
                    small
                    label={i18nKey("moderationReport.oohAck")}
                    checked={form.oohAcknowledged}
                    onChange={() => (form.oohAcknowledged = !form.oohAcknowledged)} />
            {/if}
            {#if form.failed}
                <Body colour={"validationError"}>
                    {#if form.failureMessage !== undefined}
                        {form.failureMessage}
                    {:else}
                        <Translatable resourceKey={i18nKey("moderationReport.failed")} />
                    {/if}
                </Body>
            {/if}
            <Button disabled={form.busy || !form.autoValid} loading={form.busy} onClick={submitAuto}>
                <Translatable resourceKey={i18nKey("moderationReport.startFiling")} />
            </Button>
        {/if}
    </Column>
</Sheet>

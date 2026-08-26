<script lang="ts">
    import type { NcaPriority, OpenChat } from "@client";
    import { platformOperatorStore } from "@client";
    import { Body, BodySmall, Button, Column, Input, Row, Sheet, Subtitle } from "component-lib";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import {
        NCA_PRIORITY_LABELS,
        contactValid,
        ncaReporterUrl,
        outsideNcaBusinessHours,
        startAutomatedFiling,
    } from "../../utils/ncaFiling";
    import Checkbox from "../../components/Checkbox.svelte";
    import Radio from "../../components/Radio.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        reportIndex: bigint;
        urgent: boolean;
        onFiled: (portalReference: string) => void;
        onFilingStarted?: () => void;
        onClose: () => void;
    }

    let { reportIndex, urgent, onFiled, onFilingStarted, onClose }: Props = $props();

    // Automated filing is offered whenever the reporting service is configured; recording a
    // manual portal filing stays available to platform operators (the original path)
    let autoAvailable = ncaReporterUrl !== "";
    let mode = $state<"auto" | "manual">(ncaReporterUrl !== "" ? "auto" : "manual");

    // --- manual mode ---
    let reference = $state("");

    // --- automated mode ---
    // The moderator's own assessment; urgent verdicts suggest P1 but never decide it
    let priority = $state<NcaPriority>(urgent ? "P1" : "P3");
    let firstName = $state("");
    let lastName = $state("");
    let countryCallingCode = $state("+44");
    let phone = $state("");
    let email = $state("");
    let oohAcknowledged = $state(false);
    let outOfHours = outsideNcaBusinessHours();
    let needsOohAck = $derived(outOfHours && (priority === "P1" || priority === "P2"));

    let busy = $state(false);
    let failed = $state(false);
    let failureMessage = $state<string | undefined>(undefined);

    let contact = $derived({
        firstName,
        lastName,
        phone,
        countryCallingCode,
        email,
    });
    let autoValid = $derived(contactValid(contact) && (!needsOohAck || oohAcknowledged));

    // Records that the NCA (CSEA-IRP) filing was made on the portal by hand: captures the
    // returned reference (URN) in the register
    function submitManual() {
        const trimmed = reference.trim();
        if (trimmed === "" || busy) return;
        busy = true;
        failed = false;
        client.recordAuthorityReportFiled(reportIndex, trimmed, urgent, false).then((success) => {
            busy = false;
            if (success) {
                onFiled(trimmed);
            } else {
                failed = true;
            }
        });
    }

    // Opens a signed filing window and hands it to the reporting service; the card tracks
    // the outcome via its authorityReport state
    function submitAuto() {
        if (!autoValid || busy) return;
        busy = true;
        failed = false;
        failureMessage = undefined;
        startAutomatedFiling(client, reportIndex, priority, contact, oohAcknowledged).then(
            (result) => {
                busy = false;
                if (result.kind === "started") {
                    onFilingStarted?.();
                    onClose();
                } else {
                    failed = true;
                    failureMessage = result.message;
                }
            },
        );
    }
</script>

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable
                resourceKey={i18nKey(
                    mode === "auto"
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
        {#if autoAvailable && $platformOperatorStore}
            <Row gap={"md"}>
                <Button secondary={mode !== "auto"} onClick={() => (mode = "auto")}>
                    <Translatable resourceKey={i18nKey("moderationReport.fileAutomatically")} />
                </Button>
                <Button secondary={mode !== "manual"} onClick={() => (mode = "manual")}>
                    <Translatable resourceKey={i18nKey("moderationReport.recordFiling")} />
                </Button>
            </Row>
        {/if}
        {#if mode === "manual"}
            <Input placeholder={$_("moderationReport.filingReference")} bind:value={reference} />
            {#if failed}
                <Body colour={"error"}>
                    <Translatable resourceKey={i18nKey("moderationReport.failed")} />
                </Body>
            {/if}
            <Button disabled={busy || reference.trim() === ""} loading={busy} onClick={submitManual}>
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
                    checked={priority === value}
                    onChange={() => (priority = value)}
                    label={i18nKey(label)} />
            {/each}
            <BodySmall colour={"textSecondary"} uppercase>
                <Translatable resourceKey={i18nKey("moderationReport.reporterContact")} />
            </BodySmall>
            <Input placeholder={$_("moderationReport.firstName")} bind:value={firstName} />
            <Input placeholder={$_("moderationReport.lastName")} bind:value={lastName} />
            <Input
                placeholder={$_("moderationReport.diallingCode")}
                bind:value={countryCallingCode} />
            <Input placeholder={$_("moderationReport.phone")} bind:value={phone} />
            <Input placeholder={$_("moderationReport.email")} bind:value={email} />
            {#if needsOohAck}
                <Body colour={"error"}>
                    <Translatable resourceKey={i18nKey("moderationReport.oohWarning")} />
                </Body>
                <Checkbox
                    id="ooh-ack"
                    small
                    label={i18nKey("moderationReport.oohAck")}
                    checked={oohAcknowledged}
                    onChange={() => (oohAcknowledged = !oohAcknowledged)} />
            {/if}
            {#if failed}
                <Body colour={"error"}>
                    {#if failureMessage !== undefined}
                        {failureMessage}
                    {:else}
                        <Translatable resourceKey={i18nKey("moderationReport.failed")} />
                    {/if}
                </Body>
            {/if}
            <Button disabled={busy || !autoValid} loading={busy} onClick={submitAuto}>
                <Translatable resourceKey={i18nKey("moderationReport.startFiling")} />
            </Button>
        {/if}
    </Column>
</Sheet>

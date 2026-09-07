<script lang="ts">
    import type { NcaPriority, OpenChat } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { mobileWidth, platformOperatorStore } from "@client";
    import {
        NCA_PRIORITY_LABELS,
        contactValid,
        ncaReporterUrl,
        outsideNcaBusinessHours,
        startAutomatedFiling,
    } from "../../utils/ncaFiling";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Checkbox from "../Checkbox.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Input from "../Input.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Radio from "../Radio.svelte";
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

<Overlay {onClose} dismissible>
    <ModalContent {onClose}>
        {#snippet header()}
            <Translatable
                resourceKey={i18nKey(
                    mode === "auto"
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
                {#if autoAvailable && $platformOperatorStore}
                    <div class="mode">
                        <Button
                            tiny
                            secondary={mode !== "auto"}
                            onClick={() => (mode = "auto")}>
                            <Translatable
                                resourceKey={i18nKey("moderationReport.fileAutomatically")} />
                        </Button>
                        <Button
                            tiny
                            secondary={mode !== "manual"}
                            onClick={() => (mode = "manual")}>
                            <Translatable resourceKey={i18nKey("moderationReport.recordFiling")} />
                        </Button>
                    </div>
                {/if}
                {#if mode === "manual"}
                    <Legend label={i18nKey("moderationReport.filingReference")} />
                    <Input bind:value={reference} />
                {:else}
                    <Legend label={i18nKey("moderationReport.priority")} />
                    {#each NCA_PRIORITY_LABELS as [value, label] (value)}
                        <Radio
                            id={`nca-priority-${value}`}
                            group="nca-priority"
                            checked={priority === value}
                            onChange={() => (priority = value)}
                            label={i18nKey(label)} />
                    {/each}
                    <Legend label={i18nKey("moderationReport.reporterContact")} />
                    <div class="contact-row">
                        <Input
                            bind:value={firstName}
                            placeholder={i18nKey("moderationReport.firstName")} />
                        <Input
                            bind:value={lastName}
                            placeholder={i18nKey("moderationReport.lastName")} />
                    </div>
                    <div class="contact-row">
                        <div class="dialling">
                            <Input
                                bind:value={countryCallingCode}
                                placeholder={i18nKey("moderationReport.diallingCode")} />
                        </div>
                        <Input
                            bind:value={phone}
                            placeholder={i18nKey("moderationReport.phone")} />
                    </div>
                    <Input bind:value={email} placeholder={i18nKey("moderationReport.email")} />
                    {#if needsOohAck}
                        <div class="ooh">
                            <p>
                                <Translatable
                                    resourceKey={i18nKey("moderationReport.oohWarning")} />
                            </p>
                            <Checkbox
                                id="ooh-ack"
                                small
                                label={i18nKey("moderationReport.oohAck")}
                                checked={oohAcknowledged}
                                onChange={() => (oohAcknowledged = !oohAcknowledged)} />
                        </div>
                    {/if}
                {/if}
                {#if failed}
                    <ErrorMessage>
                        {#if failureMessage !== undefined}
                            {failureMessage}
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
                {#if mode === "manual"}
                    <Button
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        disabled={busy || reference.trim() === ""}
                        loading={busy}
                        onClick={submitManual}>
                        <Translatable resourceKey={i18nKey("moderationReport.filingSubmit")} />
                    </Button>
                {:else}
                    <Button
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        disabled={busy || !autoValid}
                        loading={busy}
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

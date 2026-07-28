<script lang="ts">
    import type { OpenChat } from "@client";
    import { Body, Button, Column, Input, Sheet, Subtitle } from "component-lib";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        reportIndex: bigint;
        urgent: boolean;
        onFiled: (portalReference: string) => void;
        onClose: () => void;
    }

    let { reportIndex, urgent, onFiled, onClose }: Props = $props();

    let reference = $state("");
    let busy = $state(false);
    let failed = $state(false);

    // Records that the NCA (CSEA-IRP) filing was made for this report: the filing itself
    // happens on the portal; this captures the returned reference (URN) in the register
    function submit() {
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
</script>

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("moderationReport.recordFiling")} />
        </Subtitle>
        <Body>
            <Translatable
                resourceKey={i18nKey(
                    urgent ? "moderationReport.ncaDueUrgent" : "moderationReport.ncaDue",
                )}
            />
        </Body>
        <Input placeholder={"Portal reference (URN)"} bind:value={reference} />
        {#if failed}
            <Body colour={"error"}>
                <Translatable resourceKey={i18nKey("moderationReport.failed")} />
            </Body>
        {/if}
        <Button disabled={busy || reference.trim() === ""} loading={busy} onClick={submit}>
            <Translatable resourceKey={i18nKey("moderationReport.filingSubmit")} />
        </Button>
    </Column>
</Sheet>

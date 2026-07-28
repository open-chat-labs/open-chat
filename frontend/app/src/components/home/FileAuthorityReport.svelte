<script lang="ts">
    import type { OpenChat } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { mobileWidth } from "@client";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Input from "../Input.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
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

<Overlay {onClose} dismissible>
    <ModalContent {onClose}>
        {#snippet header()}
            <Translatable resourceKey={i18nKey("moderationReport.recordFiling")} />
        {/snippet}
        {#snippet body()}
            <div class="filing">
                <p>
                    <Translatable
                        resourceKey={i18nKey(
                            urgent ? "moderationReport.ncaDueUrgent" : "moderationReport.ncaDue",
                        )}
                    />
                </p>
                <Legend label={i18nKey("moderationReport.filingReference")} />
                <Input bind:value={reference} />
                {#if failed}
                    <ErrorMessage>
                        <Translatable resourceKey={i18nKey("moderationReport.failed")} />
                    </ErrorMessage>
                {/if}
            </div>
        {/snippet}
        {#snippet footer()}
            <ButtonGroup>
                <Button secondary small={!$mobileWidth} tiny={$mobileWidth} onClick={onClose}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </Button>
                <Button
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    disabled={busy || reference.trim() === ""}
                    loading={busy}
                    onClick={submit}
                >
                    <Translatable resourceKey={i18nKey("moderationReport.filingSubmit")} />
                </Button>
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
</style>

<script lang="ts">
    import { iconSize, mobileWidth, type ChatIdentifier, type OpenChat } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Flag from "svelte-material-icons/Flag.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import Button from "@src/ui/Button.svelte";
    import ButtonGroup from "@src/ui/ButtonGroup.svelte";
    import Checkbox from "@src/desktop/shared/Checkbox.svelte";
    import Legend from "@src/desktop/shared/Legend.svelte";
    import ModalContent from "@src/ui/ModalContent.svelte";
    import Overlay from "@src/ui/Overlay.svelte";
    import Select from "@src/desktop/shared/Select.svelte";
    import Translatable from "@src/ui/Translatable.svelte";
    import Markdown from "@src/ui/Markdown.svelte";

    interface Props {
        chatId: ChatIdentifier;
        messageId: bigint;
        threadRootMessageIndex: number | undefined;
        canDelete: boolean;
        onClose: () => void;
    }

    let { chatId, messageId, threadRootMessageIndex, canDelete, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    let deleteMessage = $state(false);
    let busy = false;
    let selectedReasonIndex = $state(-1);
    let reasons = [
        "report.pleaseSelect",
        "report.threat",
        "report.child",
        "report.nonConsensual",
        "report.selfHarm",
        "report.violence",
        "report.scam",
    ];

    let valid = $derived(selectedReasonIndex > -1);

    function createReport() {
        report();
        onClose();
    }

    function report() {
        client
            .reportMessage(chatId, threadRootMessageIndex, messageId, canDelete && deleteMessage)
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey("report.success"));
                } else {
                    toastStore.showFailureToast(i18nKey("report.failure"));
                }
            });
    }
</script>

<Overlay {onClose} dismissible>
    <ModalContent {onClose} closeIcon>
        {#snippet header()}
            <span class="header">
                <Flag size={$iconSize} color={"var(--error)"} />
                <h1><Translatable resourceKey={i18nKey("report.title")} /></h1>
            </span>
        {/snippet}
        {#snippet body()}
            <span>
                <div class="reason">
                    <Legend label={i18nKey("report.reason")} />
                    <Select bind:value={selectedReasonIndex}>
                        {#each reasons as reason, i}
                            <option disabled={i === 0} value={i - 1}
                                ><Translatable resourceKey={i18nKey(reason)} /></option>
                        {/each}
                    </Select>
                </div>
                {#if canDelete}
                    <div class="delete">
                        <Checkbox
                            id={"delete_message"}
                            label={i18nKey("report.deleteMessage")}
                            bind:checked={deleteMessage} />
                    </div>
                {/if}
                <div class="advice">
                    <Markdown
                        text={$_("report.advice", {
                            values: { rules: "https://oc.app/guidelines?section=3" },
                        })} />
                </div>
            </span>
        {/snippet}
        {#snippet footer()}
            <span>
                <ButtonGroup>
                    <Button secondary small={!$mobileWidth} tiny={$mobileWidth} onClick={onClose}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    <Button
                        disabled={busy || !valid}
                        loading={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        onClick={createReport}
                        ><Translatable resourceKey={i18nKey("report.menu")} /></Button>
                </ButtonGroup>
            </span>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .header {
        display: flex;
        gap: $sp3;
        align-items: center;
    }

    .advice {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
    }

    .delete {
        margin-bottom: $sp4;
    }
</style>

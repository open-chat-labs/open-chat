<script lang="ts">
    import Overlay from "../Overlay.svelte";
    import TextArea from "../TextArea.svelte";
    import Select from "../Select.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import Checkbox from "../Checkbox.svelte";
    import Markdown from "./Markdown.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../stores/iconSize";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Flag from "svelte-material-icons/Flag.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { toastStore } from "../../stores/toast";

    export let chatId: string;
    export let eventIndex: number;
    export let messageId: bigint;
    export let threadRootMessageIndex: number | undefined;
    export let canDelete: boolean;

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    let deleteMessage = false;
    let busy = false;
    let note: string;
    let selectedReasonIndex = -1;
    let reasons = [
        $_("report.pleaseSelect"),
        $_("report.threat"),
        $_("report.child"),
        $_("report.nonConsensual"),
        $_("report.selfHarm"),
        $_("report.violence"),
        $_("report.scam"),
        $_("report.other"),
    ];

    $: valid = selectedReasonIndex > -1 && (selectedReasonIndex !== 8 || note.length > 0);

    function createReport() {
        report();
        if (deleteMessage) {
            doDelete();
        }
        dispatch("close");
    }

    function report() {
        client
            .reportMessage(
                chatId,
                eventIndex,
                selectedReasonIndex,
                note.length > 0 ? note : undefined,
                threadRootMessageIndex
            )
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast("report.success");
                } else {
                    toastStore.showFailureToast("report.failure");
                }
            });
    }

    function doDelete() {
        client.deleteMessage(chatId, threadRootMessageIndex, messageId, false).then((success) => {
            if (!success) {
                toastStore.showFailureToast("deleteFailed");
            }
        });
    }
</script>

<Overlay on:close dismissible>
    <ModalContent on:close closeIcon>
        <span class="header" slot="header">
            <Flag size={$iconSize} color={"var(--error)"} />
            <h1>{$_("report.title")}</h1>
        </span>
        <span slot="body">
            <div class="reason">
                <Legend label={$_("report.reason")} />
                <Select bind:value={selectedReasonIndex}>
                    {#each reasons as reason, i}
                        <option disabled={i === 0} value={i - 1}>{reason}</option>
                    {/each}
                </Select>
            </div>
            <div class="note">
                <Legend label={$_("report.note")} rules={$_("report.optional")} />
                <TextArea
                    maxlength={200}
                    rows={3}
                    placeholder={$_("report.notePlaceholder")}
                    bind:value={note} />
                {#if canDelete}
                    <div class="delete">
                        <Checkbox
                            id={"delete_message"}
                            label={$_("report.deleteMessage")}
                            bind:checked={deleteMessage} />
                    </div>
                {/if}
            </div>
            <div class="advice">
                <Markdown text={$_("report.advice")} />
            </div>
        </span>
        <span slot="footer">
            <ButtonGroup>
                <Button
                    secondary
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={() => dispatch("close")}>{$_("cancel")}</Button>
                <Button
                    disabled={busy || !valid}
                    loading={busy}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={createReport}>{$_("report.menu")}</Button>
            </ButtonGroup>
        </span>
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

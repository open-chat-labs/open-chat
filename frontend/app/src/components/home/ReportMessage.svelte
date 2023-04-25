<script lang="ts">
    import Overlay from "../Overlay.svelte";
    import TextArea from "../TextArea.svelte";
    import Select from "../Select.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../stores/iconSize";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Flag from "svelte-material-icons/Flag.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { Message, OpenChat } from "openchat-client";
    import { toastStore } from "../../stores/toast";

    export let chatId: string;
    export let msg: Message;

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    let busy = false;
    let note: string;
    let selectedReasonIndex = -1;
    let reasons = [
        {
            label: $_("report.pleaseSelect"),
            index: -1,
        },
        {
            label: $_("report.threat"),
            index: 0,
        },
        {
            label: $_("report.child"),
            index: 1,
        },
        {
            label: $_("report.nonConsensual"),
            index: 2,
        },
        {
            label: $_("report.misleading"),
            index: 3,
        },
        {
            label: $_("report.deception"),
            index: 4,
        },
        {
            label: $_("report.selfHarm"),
            index: 5,
        },
        {
            label: $_("report.violence"),
            index: 6,
        },
        {
            label: $_("report.scam"),
            index: 7,
        },
        {
            label: $_("report.other"),
            index: 8,
        },
    ];

    $: valid = selectedReasonIndex > -1 && (selectedReasonIndex !== 8 || note.length > 0);

    function createReport() {
        busy = true;
        // client
        //     .setMessageReminder(chatId, eventIndex, remindAtMs, note, threadRootMessageIndex)
        //     .then((success) => {
        //         if (success) {
        //             toastStore.showSuccessToast("reminders.success");
        //         } else {
        //             toastStore.showFailureToast("reminders.failure");
        //         }
        //     })
        //     .finally(() => (busy = false));
        dispatch("close");
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
                    {#each reasons as reason}
                        <option disabled={reason.index === -1} value={reason.index}
                            >{reason.label}</option>
                    {/each}
                </Select>
            </div>
            <div class="note">
                <Legend label={$_("report.note")} rules={$_("report.optional")} />
                <TextArea
                    maxlength={1000}
                    rows={4}
                    placeholder={$_("report.notePlaceholder")}
                    bind:value={note} />
            </div>
            <div class="advice">
                {$_("report.advice")}
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

<style type="text/scss">
    .header {
        display: flex;
        gap: $sp3;
        align-items: center;
    }

    .advice {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
    }
</style>

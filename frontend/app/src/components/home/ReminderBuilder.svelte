<script lang="ts">
    import Overlay from "../Overlay.svelte";
    import TextArea from "../TextArea.svelte";
    import Select from "../Select.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { getContext } from "svelte";
    import { now } from "../../stores/time";
    import type { ChatIdentifier, OpenChat } from "openchat-client";
    import { toastStore } from "../../stores/toast";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    interface Props {
        chatId: ChatIdentifier;
        eventIndex: number;
        threadRootMessageIndex: number | undefined;
        onClose: () => void;
    }

    let { chatId, eventIndex, threadRootMessageIndex, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    let busy = $state(false);
    let note: string = $state("");
    let selectedIntervalIndex = $state(0);
    let intervals = [
        {
            label: i18nKey("reminders.twentyMinutes"),
            index: 0,
        },
        {
            label: i18nKey("reminders.oneHour"),
            index: 1,
        },
        {
            label: i18nKey("reminders.threeHours"),
            index: 2,
        },
        {
            label: i18nKey("reminders.tomorrow"),
            index: 3,
        },
        {
            label: i18nKey("reminders.nextWeek"),
            index: 4,
        },
    ];

    function deriveRemindAt(now: number, interval: number): number {
        if (interval === 0) {
            return now + 20 * 60 * 1000;
        }
        if (interval === 1) {
            return now + 60 * 60 * 1000;
        }
        if (interval === 2) {
            return now + 180 * 60 * 1000;
        }
        if (interval === 3) {
            return tomorrow(now);
        }
        if (interval === 4) {
            return nextWeek(now);
        }
        return now;
    }

    function nextWeek(now: number) {
        const date = new Date(now);
        date.setDate(date.getDate() + ((1 + 7 - date.getDay()) % 7));
        return toNine(date).getTime();
    }

    function tomorrow(now: number) {
        const date = new Date(now);
        date.setDate(date.getDate() + 1);
        return toNine(date).getTime();
    }

    function toNine(date: Date): Date {
        date.setHours(9);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        return date;
    }

    function createReminder() {
        busy = true;
        client
            .setMessageReminder(chatId, eventIndex, remindAtMs, note, threadRootMessageIndex)
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey("reminders.success"));
                } else {
                    toastStore.showFailureToast(i18nKey("reminders.failure"));
                }
            })
            .finally(() => (busy = false));
        onClose();
    }
    let remindAtMs = $derived(deriveRemindAt($now, selectedIntervalIndex));
    let remindAtDate = $derived(new Date(remindAtMs));
</script>

<Overlay {onClose} dismissible>
    <ModalContent {onClose} closeIcon>
        {#snippet header()}
            <h1>⏰ <Translatable resourceKey={i18nKey("reminders.title")} /></h1>
        {/snippet}
        {#snippet body()}
            <div class="interval">
                <Legend label={i18nKey("reminders.menu")} />
                <Select bind:value={selectedIntervalIndex}>
                    {#each intervals as interval}
                        <option value={interval.index}
                            ><Translatable resourceKey={interval.label} /></option>
                    {/each}
                </Select>
            </div>
            <div class="note">
                <Legend label={i18nKey("reminders.note")} rules={i18nKey("reminders.optional")} />
                <TextArea
                    maxlength={1000}
                    rows={4}
                    placeholder={i18nKey("reminders.notePlaceholder")}
                    bind:value={note} />
            </div>

            <div class="remind-at">
                <Translatable
                    resourceKey={i18nKey("reminders.remindAt", {
                        datetime: client.toDatetimeString(remindAtDate),
                    })} />
            </div>
        {/snippet}
        {#snippet footer()}
            <ButtonGroup>
                <Button secondary small={!$mobileWidth} tiny={$mobileWidth} on:click={onClose}
                    ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                <Button
                    disabled={busy}
                    loading={busy}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={createReminder}
                    ><Translatable resourceKey={i18nKey("reminders.create")} /></Button>
            </ButtonGroup>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .remind-at {
        color: var(--txt-light);
        @include font(book, normal, fs-80);
    }
</style>

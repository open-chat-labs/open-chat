<script lang="ts">
    import {
        mobileWidth,
        REMINDER_PRESETS,
        reminderPresetText,
        reminderTime,
        type ChatIdentifier,
        type OpenChat,
    } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { now } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import DateInput from "../DateInput.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Select from "../Select.svelte";
    import TextArea from "../TextArea.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

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
    // the presets (reminderTime), then a custom time
    const CUSTOM = REMINDER_PRESETS.length;
    const intervals = [
        ...REMINDER_PRESETS.map((preset, index) => ({ label: reminderPresetText(preset), index })),
        { label: i18nKey("reminders.custom"), index: CUSTOM },
    ];

    function deriveRemindAt(now: number, interval: number): number {
        const preset = REMINDER_PRESETS[interval];
        if (preset !== undefined) {
            return reminderTime(preset, now);
        }
        if (interval === CUSTOM && customTimestamp != null) {
            return Number(customTimestamp);
        }
        return now;
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
    let customTimestamp = $state<bigint | null | undefined>();
    let remindAtMs = $derived(deriveRemindAt($now, selectedIntervalIndex));
    let remindAtDate = $derived(new Date(remindAtMs));
    let valid = $derived(remindAtMs >= $now);
</script>

<Overlay {onClose} dismissible>
    <ModalContent overflowVisible {onClose} closeIcon>
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
            {#if selectedIntervalIndex === CUSTOM}
                <div class="custom">
                    <DateInput
                        futureOnly
                        placeholder={i18nKey("reminders.customPlaceholder")}
                        onchange={(t) => (customTimestamp = t)}
                        value={customTimestamp} />
                </div>
            {/if}
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
                <Button secondary small={!$mobileWidth} tiny={$mobileWidth} onClick={onClose}
                    ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                <Button
                    disabled={busy || !valid}
                    loading={busy}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    onClick={createReminder}
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

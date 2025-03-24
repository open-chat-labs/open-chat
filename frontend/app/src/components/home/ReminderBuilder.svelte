<script lang="ts">
    import Overlay from "../Overlay.svelte";
    import TextArea from "../TextArea.svelte";
    import Select from "../Select.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContentLegacy.svelte";
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { createEventDispatcher, getContext } from "svelte";
    import { now } from "../../stores/time";
    import type { ChatIdentifier, OpenChat } from "openchat-client";
    import { toastStore } from "../../stores/toast";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    export let chatId: ChatIdentifier;
    export let eventIndex: number;
    export let threadRootMessageIndex: number | undefined;

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    let busy = false;
    let note: string = "";
    let selectedIntervalIndex = 0;
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

    $: remindAtMs = deriveRemindAt($now, selectedIntervalIndex);
    $: remindAtDate = new Date(remindAtMs);

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
        dispatch("close");
    }
</script>

<Overlay onClose={() => dispatch("close")} dismissible>
    <ModalContent on:close closeIcon>
        <span slot="header">
            <h1>⏰ <Translatable resourceKey={i18nKey("reminders.title")} /></h1>
        </span>
        <span slot="body">
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
        </span>
        <span slot="footer">
            <ButtonGroup>
                <Button
                    secondary
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={() => dispatch("close")}
                    ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                <Button
                    disabled={busy}
                    loading={busy}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={createReminder}
                    ><Translatable resourceKey={i18nKey("reminders.create")} /></Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style lang="scss">
    .remind-at {
        color: var(--txt-light);
        @include font(book, normal, fs-80);
    }
</style>

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
    import { createEventDispatcher, getContext } from "svelte";
    import { now } from "../../stores/time";
    import type { OpenChat } from "openchat-client";
    import { toastStore } from "../../stores/toast";

    export let chatId: string;
    export let eventIndex: number;
    export let threadRootMessageIndex: number | undefined;

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    let busy = false;
    let note: string;
    let selectedIntervalIndex = 0;
    let intervals = [
        {
            label: $_("reminders.twentyMinutes"),
            index: 0,
        },
        {
            label: $_("reminders.oneHour"),
            index: 1,
        },
        {
            label: $_("reminders.threeHours"),
            index: 2,
        },
        {
            label: $_("reminders.tomorrow"),
            index: 3,
        },
        {
            label: $_("reminders.nextWeek"),
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
                    toastStore.showSuccessToast("reminders.success");
                    dispatch("close");
                } else {
                    toastStore.showFailureToast("reminders.failure");
                }
            }).finally(() => (busy = false));
    }
</script>

<Overlay on:close dismissible>
    <ModalContent>
        <span slot="header">
            <h1>{$_("reminders.title")}</h1>
        </span>
        <span slot="body">
            <div class="interval">
                <Legend label={$_("reminders.menu")} />
                <Select bind:value={selectedIntervalIndex}>
                    {#each intervals as interval}
                        <option value={interval.index}>{interval.label}</option>
                    {/each}
                </Select>
            </div>
            <div class="note">
                <Legend label={$_("reminders.note")} rules={$_("reminders.optional")} />
                <TextArea
                    maxlength={1000}
                    rows={4}
                    placeholder={$_("reminders.notePlaceholder")}
                    bind:value={note} />
            </div>

            <div class="remind-at">
                {$_("reminders.remindAt", {
                    values: { datetime: client.toDatetimeString(remindAtDate) },
                })}
            </div>
        </span>
        <span slot="footer">
            <ButtonGroup>
                <Button
                    secondary
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={() => dispatch("close")}>{$_("cancel")}</Button>
                <Button disabled={busy} loading={busy} small={!$mobileWidth} tiny={$mobileWidth} on:click={createReminder}
                    >{$_("reminders.create")}</Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    .remind-at {
        color: var(--txt-light);
        @include font(book, normal, fs-80);
    }
</style>
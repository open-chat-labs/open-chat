<script module lang="ts">
    export interface Props {
        align?: string;
        closeOnSelection?: boolean;
        disabled?: boolean;
        format?: string;
        futureOnly?: boolean;
        placeholder?: ResourceKey | undefined;
        required?: boolean;
        timePrecision?: "minute" | "second" | "millisecond" | null;
        valid?: boolean;
        // Provided date value in milliseconds!
        value?: bigint | null | undefined;
        onselect: (tms: bigint | undefined) => void;
    }
</script>

<script lang="ts">
    // TODO i18n localisation for the date picker!

    import { _ } from "svelte-i18n";
    import { interpolate } from "../i18n/i18n";
    import { DateInput } from "date-picker-svelte";
    import type { ResourceKey } from "openchat-client";
    import { onMount } from "svelte";

    let {
        align = "left",
        closeOnSelection = false,
        disabled = false,
        format = "dd MMM yyyy, HH:mm",
        futureOnly = false,
        placeholder = undefined,
        required = false,
        timePrecision = "minute",
        valid = true,
        value = undefined,
        onselect,
    }: Props = $props();

    // If we're only allowed to select future dates, then minimum date and
    // time selectable is current!
    let minDate: Date | undefined = futureOnly ? new Date() : undefined;

    // Allow selection of up to 10 years in the future.
    let maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 10);

    // Initialise local date from the provided value on component mount
    let localDate: Date | undefined = $state(undefined);
    onMount(() => {
        if (typeof value === "number") {
            localDate = new Date(Number(value));
        }
    });
</script>

<div class={`input-wrapper date-time ${align}`}>
    <DateInput
        bind:value={localDate}
        min={minDate}
        max={maxDate}
        {format}
        {timePrecision}
        {closeOnSelection}
        {disabled}
        {required}
        {valid}
        visible={false}
        placeholder={placeholder !== undefined ? interpolate($_, placeholder) : ""}
        on:select={(v: { detail: Date }) => {
            onselect?.(BigInt(v.detail.getTime()));
        }} />
</div>

<style lang="scss">
    .input-wrapper {
        position: relative;
        margin-bottom: $sp3;

        @include mobile() {
            margin-bottom: $sp3;
        }
    }

    :global(body) {
        --date-picker-foreground: var(--landing-txt);
        --date-picker-background: var(--landing-bg);
        --date-picker-highlight-border: hsl(var(--deg), 98%, 49%);
        --date-picker-highlight-shadow: hsla(var(--deg), 98%, 49%, 50%);
        --date-picker-selected-color: hsl(var(--deg), 100%, 85%);
        --date-picker-selected-background: hsla(var(--deg), 98%, 49%, 20%);
    }

    :global {
        .date-time input[type="text"] {
            transition: border ease-in-out 300ms;
            display: block;
            width: 100%;

            @include input();

            &::placeholder {
                color: var(--placeholder);
            }
        }

        .date-time {
            &.left input[type="text"] {
                text-align: left;
            }

            &.right input[type="text"] {
                text-align: right;
            }

            &.center input[type="text"] {
                text-align: center;
            }
        }

        .date-time .picker option {
            /* Bg color of the month and year dropdown selects */
            background: var(--bd);
        }
    }
</style>

<script lang="ts">
    // TODO i18n localisation!

    import { _ } from "svelte-i18n";
    import { interpolate } from "../i18n/i18n";
    import { DateInput } from "date-picker-svelte";
    import type { ResourceKey } from "openchat-client";
    import { onMount } from "svelte";

    export let onSelect: (d: number | undefined) => void = () => {};
    export let align = "left";
    export let futureOnly = false;
    export let closeOnSelection = false;
    export let disabled = false;
    export let required = false;
    export let valid = true;
    export let timePrecision: "minute" | "second" | "millisecond" | null = "minute";
    export let format = "dd MMM yyyy, HH:mm";
    export let placeholder: ResourceKey | undefined = undefined;

    // Provided date value in milliseconds!
    export let value: BigInt | null | undefined = undefined;

    // If we're only allowed to select future dates, then minimum date and
    // time selectable is current!
    let minDate: Date | undefined;
    if (futureOnly) {
        minDate = new Date();
    }

    // Allow selection of up to 10 years in the future.
    let maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 10);

    // Initialise local date from the provided value on component mount
    let localDate: Date | undefined;
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
        on:select={(v) => {
            onSelect(v.detail.getMilliseconds());
        }}
        placeholder={placeholder !== undefined ? interpolate($_, placeholder) : ""} />
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

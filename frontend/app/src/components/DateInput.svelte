<script module lang="ts">
    export interface Props {
        align?: string;
        disabled?: boolean;
        endDate?: string | Date;
        format?: string;
        futureOnly?: boolean;
        inputId?: string;
        inputClasses?: string;
        mode?: "date" | "time" | "datetime";
        pickerOnly?: boolean;
        placeholder?: ResourceKey | undefined;
        required?: boolean;
        startDate?: string | Date;
        value?: bigint | null | undefined;
        onchange?: (val: bigint | null) => void;
    }
</script>

<script lang="ts">
    // TODO i18n localisation for the date picker!

    import { _ } from "svelte-i18n";
    import { interpolate, i18nKey } from "../i18n/i18n";
    import SveltyPicker from "svelty-picker";
    import type { ResourceKey } from "openchat-client";
    import { onMount } from "svelte";
    import TooltipWrapper from "./TooltipWrapper.svelte";
    import TooltipPopup from "./TooltipPopup.svelte";
    import Translatable from "./Translatable.svelte";
    import Information from "svelte-material-icons/Information.svelte";

    let {
        align = "left",
        disabled = false,
        endDate = undefined,
        format = "dd M yyyy, hh:ii",
        futureOnly = false,
        inputId = undefined,
        inputClasses = "",
        mode = "datetime",
        pickerOnly = false,
        placeholder = undefined,
        required = false,
        startDate = undefined,
        value = undefined,
        onchange = undefined,
    }: Props = $props();

    let dateIsValid = $state(true);

    // Initialise local date from the provided value on component mount
    let localDate: string | undefined = $state(undefined);
    onMount(() => {
        if (typeof value === "number") {
            localDate = (new Date(Number(value))).toISOString();
        }
    });
</script>

<div class={`input-wrapper date-time ${align} ${!dateIsValid ? "error" : ""}`}>
    <SveltyPicker
        value={localDate}
        {disabled}
        {endDate}
        {format}
        {inputId}
        inputClasses={`date-time ${inputClasses}`}
        {mode}
        {pickerOnly}
        placeholder={placeholder !== undefined ? interpolate($_, placeholder) : ""}
        {required}
        {startDate}
        onDateChange={({ dateValue }) => {
            if (futureOnly && dateValue instanceof Date && dateValue < new Date()) {
                dateIsValid = false;
            } else {
                dateIsValid = true;
            }
            dateValue instanceof Date
                ? onchange?.(BigInt(dateValue.getTime()))
                : onchange?.(null);
        }}
    />
    {#if !dateIsValid}
        <div class="error-icon">
            <TooltipWrapper position={"top"} align={"middle"}>
                <div slot="target" class="param" class:required={required}>
                    <Information width="1.25rem" height="1.25rem" />
                </div>
                <div let:position let:align slot="tooltip">
                    <TooltipPopup {align} {position}>
                        <Translatable resourceKey={i18nKey("mustBeFutureDateError")} />
                    </TooltipPopup>
                </div>
            </TooltipWrapper>
        </div>
    {/if}
</div>

<style lang="scss">
    .input-wrapper {
        position: relative;
        margin-bottom: $sp3;

        @include mobile() {
            margin-bottom: $sp3;
        }

        :global(.sdt-component-wrap),
        :global(.sdt-input-wrap) {
            width: 100%;
        }

        :global(.sdt-tick) {
            background-color: transparent;
        }

        :global(input[name="date_input"]) {
            @include input();
            width: 100%;;

            &::placeholder {
                color: var(--placeholder);
            }
        }

        &.error {
            :global(input[name="date_input"]) {
                box-shadow: 0 0 0 1px var(--error);
            }
        }

        .error-icon {
            position: absolute;
            right: $sp3;
            width: 1.25rem;
            height: 1.25rem;
            top: 50%;
            transform: translateY(-50%);

            :global(svg > path) {
                fill: var(--error);
            }
        }
    }

    :global(body) {
        
        /* general */
        --sdt-bg-main: var(--bd);
        --sdt-shadow-color: var(--bg);
        --sdt-wrap-shadow: 0 1px 6px var(--sdt-shadow-color); /** wrap shadow settings */
        --sdt-radius: 4px; /** wrap radius */
        --sdt-color: var(--txt);
        --sdt-color-selected: var(--txt); /** selected data(e.g date/time) text color */
        --sdt-header-color: var(--txt);; /** header items color (e.g. text & buttons) */
        --sdt-header-btn-bg-hover: transparent; /** header items hover background color */
        --sdt-bg-selected: var(--primary);

        /* date picker */
        --sdt-table-selected-bg: var(--sdt-bg-selected); /** selected date background color */
        --sdt-table-disabled-date: var(--unread-mute-txt); /** disabled dates text color */
        --sdt-table-disabled-date-bg: transparent; /** disabled dates background color */
        --sdt-table-bg: transparent; /** date picker inner table background color */
        --sdt-table-data-bg-hover: var(--primary); /** table selection data hover background color */
        --sdt-table-today-indicator: var(--primary); /** date picker current day marker color */

        /* action buttons */
        --sdt-today-bg: var(--reaction-me); /** date picker today button hover background color */
        --sdt-today-color: var(--txt); /** date picker today button text & border color */
        --sdt-clear-color: var(--txt-light); /** clear button text & border color */
        --sdt-clear-bg: transparent; /** clear button background color */
        --sdt-clear-hover-color: var(--txt); /** clear button hover text color */
        --sdt-clear-hover-bg: transparent; /** clear button hover background color */

        /* time picker */
        --sdt-clock-selected-bg: var(--sdt-bg-selected); /** selected time background color */
        --sdt-clock-bg: var(--input-bg); /** time picker inner circle background color */
        --sdt-clock-color: var(--txt); /** time picker text color (watch "--sdt-color") */
        --sdt-clock-color-hover: var(--txt); /** time picker hover text color (watch "--sdt-color") */
        --sdt-clock-time-bg: transparent; /** time picker time background color */
        --sdt-clock-time-bg-hover: var(--primary); /** time picker time selection hover background color */
        --sdt-clock-disabled: var(--unread-mute); /** disabled time picker time text color */
        --sdt-clock-disabled-bg: transparent; /** disabled time picker time background color */
    }
</style>

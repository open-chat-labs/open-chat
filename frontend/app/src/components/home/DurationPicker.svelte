<script lang="ts">
    import { getContext, onMount } from "svelte";
    import Input from "../Input.svelte";
    import Select from "../Select.svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat } from "openchat-client";
    import { msToDays, msToHours, msToMinutes } from "../../utils/time";

    const ONE_MINUTE = 1000 * 60;
    const ONE_HOUR = ONE_MINUTE * 60;
    const ONE_DAY = ONE_HOUR * 24;
    const client = getContext<OpenChat>("client");

    type DurationUnit = "minutes" | "hours" | "days";

    export let valid = true;
    export let milliseconds: bigint = BigInt(ONE_HOUR);
    export let disabled = false;
    export let unitFilter = (_: DurationUnit) => true;

    let initialised = false;
    let amount: string = "";
    let unit: DurationUnit;

    $: allUnits = ["minutes", "hours", "days"] as DurationUnit[];
    $: supportedDurations = allUnits.filter(unitFilter);

    onMount(() => {
        const duration = client.durationFromMilliseconds(Number(milliseconds));
        const { days, hours, minutes, total } = duration;

        if (days > 0) {
            amount = msToDays(total).toString();
            unit = "days";
        } else if (hours > 0) {
            amount = msToHours(total).toString();
            unit = "hours";
        } else if (minutes > 0) {
            amount = msToMinutes(total).toString();
            unit = "minutes";
        }
        initialised = true;
    });

    function updateAmount(amount: string) {
        if (!initialised) return;
        const ttlNum = Number(amount);
        if (isNaN(ttlNum) || amount === "") {
            valid = false;
            return;
        }
        valid = true;
        switch (unit) {
            case "minutes":
                milliseconds = BigInt(ONE_MINUTE * ttlNum);
                break;
            case "hours":
                milliseconds = BigInt(ONE_HOUR * ttlNum);
                break;
            case "days":
                milliseconds = BigInt(ONE_DAY * ttlNum);
                break;
        }
    }

    $: {
        updateAmount(amount);
    }
</script>

<div class="form">
    <div class="ttl">
        <Input {disabled} invalid={!valid} maxlength={5} minlength={1} bind:value={amount} />
    </div>

    <div class="units">
        <Select
            disabled={disabled || supportedDurations.length === 1}
            margin={false}
            onchange={() => updateAmount(amount)}
            bind:value={unit}>
            {#each supportedDurations as duration}
                <option value={duration}>{$_(duration)}</option>
            {/each}
        </Select>
    </div>
</div>

<style lang="scss">
    .form {
        display: flex;
        gap: $sp3;
    }

    .ttl {
        flex: 0 0 100px;
    }

    .units {
        flex: 0 0 150px;
    }
</style>

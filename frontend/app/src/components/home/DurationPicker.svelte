<script lang="ts">
    import { getContext, onMount } from "svelte";
    import Input from "../Input.svelte";
    import Select from "../Select.svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat } from "openchat-client";

    const ONE_MINUTE = 1000 * 60;
    const ONE_HOUR = ONE_MINUTE * 60;
    const ONE_DAY = ONE_HOUR * 24;
    const ONE_WEEK = ONE_DAY * 7;
    const ONE_MONTH = ONE_WEEK * 4;
    const client = getContext<OpenChat>("client");

    export let valid = true;
    export let milliseconds: bigint = BigInt(ONE_HOUR);
    export let disabled = false;

    let initialised = false;
    let amount: string;
    let unit: "minutes" | "hours" | "days" | "weeks" | "months";

    onMount(() => {
        const { days, hours, minutes, weeks, months } = client.durationFromMilliseconds(
            Number(milliseconds),
        );
        if (months > 0) {
            amount = months.toString();
            unit = "months";
        } else if (weeks > 0) {
            amount = weeks.toString();
            unit = "weeks";
        } else if (days > 0) {
            amount = days.toString();
            unit = "days";
        } else if (hours > 0) {
            amount = hours.toString();
            unit = "hours";
        } else if (minutes > 0) {
            amount = minutes.toString();
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
            case "months":
                milliseconds = BigInt(ONE_MONTH * ttlNum);
                break;
            case "weeks":
                milliseconds = BigInt(ONE_WEEK * ttlNum);
                break;
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
        <Select {disabled} margin={false} on:change={() => updateAmount(amount)} bind:value={unit}>
            <option value={"minutes"}>{$_("minutes")}</option>
            <option value={"hours"}>{$_("hours")}</option>
            <option value={"days"}>{$_("days")}</option>
            <option value={"weeks"}>{$_("weeks")}</option>
            <option value={"months"}>{$_("months")}</option>
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

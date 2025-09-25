<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { msToDays, msToHours, msToMinutes } from "../../utils/time";
    import Input from "../Input.svelte";
    import Select from "../Select.svelte";

    const ONE_MINUTE = 1000 * 60;
    const ONE_HOUR = ONE_MINUTE * 60;
    const ONE_DAY = ONE_HOUR * 24;
    const client = getContext<OpenChat>("client");

    type Data = { amount: string; unit: DurationUnit };
    type DurationUnit = "minutes" | "hours" | "days";

    interface Props {
        valid?: boolean;
        milliseconds?: bigint;
        disabled?: boolean;
        unitFilter?: (unit: DurationUnit) => void;
    }

    let {
        valid = $bindable(true),
        milliseconds = $bindable(BigInt(ONE_HOUR)),
        disabled = false,
        unitFilter = (_: DurationUnit) => true,
    }: Props = $props();

    let data = $state<Data>(fromMilliseconds(milliseconds));
    const allUnits = ["minutes", "hours", "days"] as DurationUnit[];
    let supportedDurations = $derived(allUnits.filter(unitFilter));

    function fromMilliseconds(milliseconds: bigint) {
        const duration = client.durationFromMilliseconds(Number(milliseconds));
        const { days, hours, minutes, total } = duration;
        let amount: string = "";
        let unit: DurationUnit = "days";
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
        return { amount, unit };
    }

    function toMilliseconds(data: Data) {
        const ttlNum = Number(data.amount);
        if (isNaN(ttlNum) || data.amount === "") {
            valid = false;
            return;
        }
        valid = true;
        switch (data.unit) {
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

    $effect(() => {
        data = fromMilliseconds(milliseconds);
    });

    $effect(() => {
        toMilliseconds(data);
    });
</script>

<div class="form">
    <div class="ttl">
        <Input {disabled} invalid={!valid} maxlength={5} minlength={1} bind:value={data.amount} />
    </div>

    <div class="units">
        <Select
            disabled={disabled || supportedDurations.length === 1}
            margin={false}
            onchange={() => toMilliseconds(data)}
            bind:value={data.unit}>
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

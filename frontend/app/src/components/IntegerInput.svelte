<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import { numberToBigInt } from "openchat-shared";
    import NumberInput from "./NumberInput.svelte";

    interface Props {
        disabled: boolean;
        autofocus: boolean;
        placeholder: ResourceKey | undefined;
        min: bigint;
        max: bigint;
        value: bigint | null;
        align: "left" | "right" | "center";
        shouldClamp: boolean;
        change: (e: CustomEvent<string>) => void;
    }

    let {
        disabled = false,
        autofocus = false,
        placeholder = undefined,
        min = BigInt(0),
        max = BigInt(1000),
        value = $bindable(min),
        align = "left",
        shouldClamp = true,
        change,
    }: Props = $props();

    let valueNum = $state(value != null ? Number(value) : null);
    $effect(() => {
        if (valueNum != null) {
            valueNum = Math.trunc(valueNum);
            value = BigInt(valueNum);
        } else {
            value = null;
        }
        console.log("Value updated", value);
    });
</script>

<NumberInput
    {disabled}
    {autofocus}
    {placeholder}
    min={Number(min)}
    max={Number(max)}
    bind:value={valueNum}
    {align}
    {shouldClamp}
    on:change={change} />
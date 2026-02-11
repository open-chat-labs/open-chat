<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import type { ResourceKey } from "openchat-client";
    import type { Snippet } from "svelte";
    import NumberInput from "./NumberInput.svelte";

    interface Props {
        disabled?: boolean;
        autofocus?: boolean;
        placeholder?: ResourceKey | undefined;
        min: bigint;
        max: bigint;
        value: bigint | null;
        align?: "left" | "right" | "center";
        shouldClamp?: boolean;
        subtext?: Snippet;
        error?: boolean;
    }

    let {
        disabled = false,
        autofocus = false,
        placeholder = undefined,
        min,
        max,
        value = $bindable(min),
        align = "left",
        shouldClamp = true,
        subtext,
        error,
    }: Props = $props();

    let valueNum = $state(value != null ? Number(value) : null);
    trackedEffect("parse-int", () => {
        if (valueNum != null) {
            valueNum = Math.trunc(valueNum);
            value = BigInt(valueNum);
        } else {
            value = null;
        }
    });
</script>

<NumberInput
    {subtext}
    {error}
    {disabled}
    {autofocus}
    {placeholder}
    min={Number(min)}
    max={Number(max)}
    bind:value={valueNum}
    {align}
    {shouldClamp} />

<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import Checkbox from "./Checkbox.svelte";
    import Translatable from "./Translatable.svelte";

    export let checked: boolean = false;
    export let disabled: boolean = false;
    export let waiting: boolean = false;
    export let label: ResourceKey | undefined = undefined;
    export let id: string;
    export let small: boolean = false;
    export let bigGap: boolean = false;
</script>

<div class="toggle-wrapper" class:big-gap={bigGap}>
    <div class="toggle">
        <Checkbox {small} {disabled} {waiting} {id} toggle on:change {label} bind:checked />
    </div>
    {#if label !== undefined}
        <div class="label" class:disabled>
            <Translatable resourceKey={label} />
        </div>
    {/if}
</div>

<style lang="scss">
    .toggle-wrapper {
        display: flex;
        align-items: center;
        gap: $sp3;
        margin-bottom: $sp4;
        .toggle {
            flex: 0 0 40px;
        }
        .label {
            flex: 1;
            &.disabled {
                color: var(--disabledTxt);
            }
        }
        &.big-gap {
            gap: $sp4;
        }
    }
</style>

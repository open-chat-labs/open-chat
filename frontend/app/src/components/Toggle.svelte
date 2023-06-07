<script lang="ts">
    import Checkbox from "./Checkbox.svelte";
    import { _ } from "svelte-i18n";

    export let checked: boolean = false;
    export let disabled: boolean = false;
    export let waiting: boolean = false;
    export let label: string | undefined = undefined;
    export let id: string;
    export let small: boolean = false;
    export let bigGap: boolean = false;
</script>

<div class="toggle-wrapper" class:big-gap={bigGap}>
    <div class="toggle">
        <Checkbox {small} {disabled} {waiting} {id} toggle on:change {label} bind:checked />
    </div>
    {#if label !== undefined}
        <div class="label">
            {label}
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
        }
        &.big-gap {
            gap: $sp4;
        }
    }
</style>

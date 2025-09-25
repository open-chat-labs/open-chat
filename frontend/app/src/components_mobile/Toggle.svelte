<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import Checkbox from "./Checkbox.svelte";
    import Translatable from "./Translatable.svelte";

    interface Props {
        checked?: boolean;
        disabled?: boolean;
        waiting?: boolean;
        label?: ResourceKey | undefined;
        id: string;
        small?: boolean;
        bigGap?: boolean;
        bottomMargin?: boolean;
        onChange?: () => void;
    }

    let {
        checked = $bindable(false),
        disabled = false,
        waiting = false,
        label = undefined,
        id,
        small = false,
        bigGap = false,
        bottomMargin = true,
        onChange,
    }: Props = $props();
</script>

<div class="toggle-wrapper" class:big-gap={bigGap} class:bottomMargin>
    <div class="toggle">
        <Checkbox {small} {disabled} {waiting} {id} toggle {onChange} {label} bind:checked />
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
        &.bottomMargin {
            margin-bottom: $sp4;
        }
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

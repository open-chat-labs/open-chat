<script lang="ts">
    import type { Snippet } from "svelte";
    import Spinner from "./Spinner.svelte";

    interface Props {
        children?: Snippet;
        disabled?: boolean;
        loading?: boolean;
        onClick?: (e: MouseEvent) => void;
    }
    let { children, disabled = false, onClick, loading = false }: Props = $props();
</script>

<button class:disabled onclick={onClick} {disabled}>
    {#if loading}
        <Spinner
            size={"1.4rem"}
            backgroundColour={"var(--textTertiary)"}
            foregroundColour={"var(--textOnPrimary)"} />
    {:else}
        {@render children?.()}
    {/if}
</button>

<style lang="scss">
    button {
        background: var(--primaryGradientInverted);
        min-height: 2.75rem;
        display: flex;
        justify-content: center;
        align-items: center;
        border: none;
        border-radius: 4px;
        color: var(--textOnPrimary);

        font-weight: 700;
        font-size: 14px;
        line-height: 20px;

        &.disabled {
            background: var(--disabledButton);
        }
    }
</style>

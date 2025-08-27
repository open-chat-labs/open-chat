<script lang="ts">
    import type { Snippet } from "svelte";
    import Spinner from "./Spinner.svelte";

    interface Props {
        children?: Snippet;
        disabled?: boolean;
        loading?: boolean;
        secondary?: boolean;
        onClick?: (e: MouseEvent) => void;
        icon?: Snippet<[string]>;
    }
    let {
        children,
        icon,
        disabled = false,
        onClick,
        loading = false,
        secondary = false,
    }: Props = $props();

    let spinnerColour = secondary ? "var(--primary)" : "var(--textOnPrimary)";
    let iconColour = secondary ? "var(--primary)" : "var(--textOnPrimary)";
</script>

<button class:secondary class:disabled onclick={onClick} disabled={disabled || loading}>
    {#if loading}
        <Spinner
            size={"1.4rem"}
            backgroundColour={"var(--textTertiary)"}
            foregroundColour={spinnerColour} />
    {:else}
        <span class="content">{@render children?.()}</span>
        {#if icon}
            <span class="icon">{@render icon(iconColour)}</span>
        {/if}
    {/if}
</button>

<style lang="scss">
    button {
        position: relative;
        background: var(--primaryGradientInverted);
        min-height: 2.75rem;
        display: flex;
        justify-content: center;
        align-items: center;
        border: none;
        border-radius: 4px;
        color: var(--textOnPrimary);
        cursor: pointer;

        font-weight: 700;
        font-size: 14px;
        line-height: 20px;

        .content {
            pointer-events: none;
        }

        &.disabled {
            background: var(--disabledButton);
        }

        &:disabled {
            cursor: not-allowed;
        }

        .icon {
            position: absolute;
            right: 0;
            top: 50%;
            transform: translateY(-50%) translateX(-50%);
            display: flex;
        }

        &.secondary {
            background: none;
            color: var(--primary);
            border: 1px solid var(--primary);

            &.disabled {
                color: var(--disabledButton);
                border-color: var(--disabledButton);
            }
        }
    }
</style>

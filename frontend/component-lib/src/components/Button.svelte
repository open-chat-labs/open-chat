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

    let spinnerColour = secondary ? "var(--primary)" : "var(--text-on-primary)";
    let iconColour = secondary ? "var(--primary)" : "var(--text-on-primary)";
</script>

<button class:secondary class:disabled onclick={onClick} disabled={disabled || loading}>
    {#if loading}
        <Spinner
            size={"1.4rem"}
            backgroundColour={"var(--text-tertiary)"}
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
        background: var(--primary-gradient-inverted);
        min-height: var(--sp-xxxl);
        display: flex;
        justify-content: center;
        align-items: center;
        border: none;
        border-radius: 4px;
        color: var(--text-on-primary);
        cursor: pointer;
        width: 100%;
        transition:
            border ease-in-out 200ms,
            background ease-in-out 200ms,
            color ease-in-out 200ms;

        font-weight: 700;
        font-size: 14px;

        .content {
            pointer-events: none;
        }

        &.disabled {
            background: var(--disabled-button);
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
                color: var(--disabled-button);
                border-color: var(--disabled-button);
            }
        }
    }
</style>

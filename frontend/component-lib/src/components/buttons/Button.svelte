<script lang="ts">
    import { getFlexStyle, type Direction, type SizeMode } from "component-lib";
    import { getContext, type Snippet } from "svelte";
    import Spinner from "../Spinner.svelte";

    interface Props {
        children?: Snippet;
        disabled?: boolean;
        loading?: boolean;
        secondary?: boolean;
        onClick?: (e: MouseEvent) => void;
        icon?: Snippet<[string]>;
        width?: SizeMode;
        height?: SizeMode;
    }
    let {
        children,
        icon,
        disabled = false,
        onClick,
        loading = false,
        secondary = false,
        width = { kind: "fill" },
        height = { kind: "hug" },
    }: Props = $props();

    let parentDirection = getContext<Direction>("direction");
    let spinnerColour = secondary ? "var(--gradient-secondary)" : "var(--text-on-primary)";
    let iconColour = secondary ? "var(--gradient-secondary)" : "var(--text-on-primary)";
    let widthCss = $derived(getFlexStyle("width", width, parentDirection));
    let heightCss = $derived(getFlexStyle("height", height, parentDirection));
    let style = $derived(`${heightCss}; ${widthCss};`);
</script>

<button
    type="button"
    aria-busy={loading}
    {style}
    class:secondary
    class:disabled={disabled || loading}
    onclick={onClick}
    disabled={disabled || loading}>
    <span class="content">
        {@render children?.()}
    </span>
    {#if loading}
        <span class="button_icon">
            <Spinner backgroundColour={"var(--text-tertiary)"} foregroundColour={spinnerColour} />
        </span>
    {:else if icon}
        <span class="button_icon">{@render icon(iconColour)}</span>
    {/if}
</button>

<style lang="scss">
    :global(.button_icon svg) {
        width: var(--icon-md);
        height: var(--icon-md);
    }

    button {
        all: unset;
        position: relative;
        min-height: 2.75rem;
        display: flex;
        justify-content: center;
        align-items: center;
        border: var(--bw-thick) solid transparent;
        border-radius: var(--rad-sm);
        color: var(--text-on-primary);
        cursor: pointer;
        transition:
            border ease-in-out 200ms,
            background ease-in-out 200ms,
            color ease-in-out 200ms;

        font-weight: var(--font-semi-bold);
        font-size: 14px; // TODO - typography vars
        z-index: 0;

        // This is a bit of a faff but we have to do the background fill this way to
        // end up with a filled button that is exactly the same size as a hollow button
        &:not(.secondary):not(.disabled)::before {
            content: "";
            position: absolute;
            inset: calc(-1 * var(--bw-thick));
            border-radius: var(--rad-sm);
            background: var(--gradient);
            z-index: -1;
        }

        .content {
            pointer-events: none;
        }

        &.disabled {
            background: var(--disabled-button);
        }

        &:disabled {
            cursor: not-allowed;
        }

        .button_icon {
            position: absolute;
            right: 0;
            top: 50%;
            transform: translateY(-50%) translateX(-50%);
            display: flex;
        }

        &.secondary {
            background: none;
            color: var(--gradient-secondary);
            border: var(--bw-thick) solid var(--gradient-secondary);

            &.disabled {
                color: var(--disabled-button);
                border-color: var(--disabled-button);
            }
        }

        // TODO - figure out out what to do with this and apply it consistently
        &:focus-visible {
            border: 1px solid var(--secondary);
            outline: none;
            outline-offset: 0px;
        }
    }
</style>

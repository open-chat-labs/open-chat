<script lang="ts">
    import { getFlexStyle, type Direction, type SizeMode } from "component-lib";
    import { getContext, type Snippet } from "svelte";
    import Spinner from "./Spinner.svelte";

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
    let spinnerColour = secondary ? "var(--primary)" : "var(--text-on-primary)";
    let iconColour = secondary ? "var(--primary)" : "var(--text-on-primary)";
    let widthCss = $derived(getFlexStyle("width", width, parentDirection));
    let heightCss = $derived(getFlexStyle("height", height, parentDirection));
    let style = $derived(`${heightCss}; ${widthCss};`);
</script>

<button
    type="button"
    aria-busy={loading}
    {style}
    class:secondary
    class:disabled
    onclick={onClick}
    disabled={disabled || loading}>
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
        all: unset;
        position: relative;
        background: var(--primary-gradient-inverted);
        min-height: var(--sp-xxxl);
        display: flex;
        justify-content: center;
        align-items: center;
        border: none;
        border-radius: var(--rad-sm);
        color: var(--text-on-primary);
        cursor: pointer;
        transition:
            border ease-in-out 200ms,
            background ease-in-out 200ms,
            color ease-in-out 200ms;

        font-weight: var(--font-semi-bold);
        font-size: 14px; // TODO - typography vars

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

        // TODO - figure out out what to do with this and apply it consistently
        &:focus-visible {
            border: 1px solid var(--secondary);
            outline: none;
            outline-offset: 0px;
        }
    }
</style>

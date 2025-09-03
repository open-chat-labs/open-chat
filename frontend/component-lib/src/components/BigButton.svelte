<script lang="ts">
    import { getContext, type Snippet } from "svelte";
    import { type Direction, getFlexStyle, type SizeMode } from "../theme";

    type Mode = "default" | "pressed" | "active";

    interface Props {
        children?: Snippet;
        mode?: Mode;
        onClick?: (e: MouseEvent) => void;
        icon: Snippet<[string]>;
        modifier?: Snippet<[string]>;
        width?: SizeMode;
        height?: SizeMode;
        disabled?: boolean;
    }
    let {
        children,
        icon,
        onClick,
        mode = "default",
        modifier,
        width = { kind: "fill" },
        height = { kind: "fill" },
        disabled = false,
    }: Props = $props();

    const iconColours: Record<Mode, string> = {
        default: "var(--text-secondary)",
        active: "var(--primary-light)",
        pressed: "var(--text-primary)",
    };

    let parentDirection = getContext<Direction>("direction");
    let widthCss = $derived(getFlexStyle("width", width, parentDirection));
    let heightCss = $derived(getFlexStyle("height", height, parentDirection));
    let style = $derived(`${heightCss}; ${widthCss};`);
    let iconColour = $derived(iconColours[mode]);
</script>

<button {disabled} type="button" {style} onclick={onClick} class={`big_button ${mode}`}>
    {#if icon}
        <span class="icon">{@render icon(iconColour)}</span>
    {/if}
    <div class="row2">
        {#if children}
            {@render children()}
        {/if}
        {#if modifier}
            <span class="modifier">{@render modifier(iconColour)}</span>
        {/if}
    </div>
</button>

<style lang="scss">
    :global(.big_button > .icon > svg) {
        width: var(--icon-md);
        height: var(--icon-md);
    }

    button {
        all: unset;
        background: var(--background-1);
        border: none;
        font-weight: 700;
        color: var(--text-primary);
        border-radius: var(--rad-sm);
        display: flex;
        gap: var(--sp-xs);
        flex-direction: column;
        align-items: start;
        justify-content: flex-end;
        padding: var(--sp-sm);
        font-size: var(--typo-bodySmall-sz);
        line-height: var(--typo-bodySmall-lh);
        cursor: pointer;
        transition:
            border ease-in-out 200ms,
            background ease-in-out 200ms,
            color ease-in-out 200ms;

        .row2 {
            display: flex;
            min-height: 20px;
            justify-content: space-between;
            align-items: center;
            width: 100%;
        }

        &.active {
            background: var(--primary-muted);
        }

        &.pressed {
            background: var(--background-2);
        }
    }
</style>

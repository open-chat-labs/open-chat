<script lang="ts">
    import { CountBadge, type Direction, getFlexStyle, type SizeMode } from "component-lib";
    import { getContext, onMount, type Snippet } from "svelte";

    type Mode = "default" | "active";
    type InternalMode = Mode | "pressed";

    interface Props {
        children?: Snippet;
        mode?: Mode;
        onClick?: (e: MouseEvent) => void;
        icon: Snippet<[string, string]>;
        countBadge?: number;
        width?: SizeMode;
        height?: SizeMode;
        disabled?: boolean;
    }
    let {
        children,
        icon,
        onClick,
        mode = "default",
        countBadge,
        width = "fill",
        height = "fill",
        disabled = false,
    }: Props = $props();

    const iconColours: Record<InternalMode, string> = {
        default: "var(--text-tertiary)",
        active: "var(--primary)",
        pressed: "var(--text-primary)",
    };
    const iconSize = "var(--icon-md)";

    const SPEED = 300;
    let internalMode = $state<InternalMode>("default");
    let parentDirection = getContext<Direction>("direction");
    let widthCss = $derived(getFlexStyle("width", width, parentDirection));
    let heightCss = $derived(getFlexStyle("height", height, parentDirection));
    let style = $derived(`--speed: ${SPEED}ms; ${heightCss}; ${widthCss};`);
    let iconColour = $derived(iconColours[internalMode]);
    let pressing = $state(false);
    let timer = $state<number>();

    onMount(() => (internalMode = mode));

    $effect(() => {
        if (mode === "active" && internalMode === "default") {
            internalMode = "pressed";
            pressing = true;
            if (timer) {
                window.clearTimeout(timer);
            }
            timer = window.setTimeout(() => {
                pressing = false;
                internalMode = "active";
            }, SPEED);
        } else if (!pressing) {
            internalMode = mode;
        }
    });
</script>

<button {disabled} type="button" {style} onclick={onClick} class={`big_button ${internalMode}`}>
    {#if icon}
        <span class="icon">{@render icon(iconColour, iconSize)}</span>
    {/if}
    <div class="row2">
        {#if children}
            {@render children()}
        {/if}
        {#if countBadge}
            <span class="modifier">
                <CountBadge mode={internalMode === "active" ? "on_primary" : "default"}
                    >{countBadge}</CountBadge>
            </span>
        {/if}
    </div>
</button>

<style lang="scss">
    :global(.big_button > .icon svg path) {
        transition: fill var(--speed) ease-in-out;
    }

    :global(.big_button > .icon > svg) {
        width: var(--icon-md);
        height: var(--icon-md);
    }

    button {
        $speed: var(--speed);
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
            border ease-in-out $speed,
            background ease-in-out $speed,
            color ease-in-out $speed;

        .row2 {
            display: flex;
            min-height: 20px;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            white-space: nowrap;
        }

        &.active {
            background: var(--background-2);
            color: var(--primary);
        }

        &.pressed {
            background: var(--background-2);
        }
    }
</style>

<script lang="ts">
    import { ColourVars, getPaddingCss, type Padding } from "component-lib";
    import type { Snippet } from "svelte";

    interface Props {
        mode?: "transparent" | "dark" | "primary" | "secondary";
        icon: Snippet<[string]>;
        disabled?: boolean;
        padding?: Padding;
        onclick?: (e?: Event) => void;
        size?: "xs" | "sm" | "md" | "lg";
    }

    let {
        icon,
        mode = "transparent",
        onclick,
        disabled = false,
        size = "md",
        padding = "sm",
    }: Props = $props();

    let paddingCss = $derived(getPaddingCss(padding));
    let iconColour = $derived.by(() => {
        switch (mode) {
            case "secondary":
                return ColourVars.textPrimary;
            case "transparent":
                return disabled ? ColourVars.disabledButton : ColourVars.textPrimary;
            case "dark":
                return ColourVars.primary;
            case "primary":
                return ColourVars.background0;
        }
    });
</script>

<button
    style={paddingCss}
    class={`icon_button ${size} ${mode}`}
    {disabled}
    type={"button"}
    {onclick}>
    {@render icon(iconColour)}
</button>

<style lang="scss">
    :global(.icon_button.lg svg) {
        width: var(--icon-lg);
        height: var(--icon-lg);
    }

    :global(.icon_button.md svg) {
        width: var(--icon-md);
        height: var(--icon-md);
    }

    :global(.icon_button.sm svg) {
        width: var(--icon-sm);
        height: var(--icon-sm);
    }

    :global(.icon_button.xs svg) {
        width: var(--icon-xs);
        height: var(--icon-xs);
    }

    button {
        all: unset;
        border-radius: var(--rad-circle);
        display: flex;
        justify-content: center;
        align-items: center;
        transition: background-color ease-in-out 100ms;
        cursor: pointer;
        aspect-ratio: 1 / 1;

        &.transparent {
            background-color: transparent;
        }

        &.dark {
            background-color: var(--background-0);
        }

        &.primary {
            background-color: var(--primary);
        }

        &.secondary {
            background-color: var(--text-tertiary);
        }
    }
</style>

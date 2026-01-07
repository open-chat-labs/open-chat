<script lang="ts">
    import { ColourVars } from "component-lib";
    import type { Snippet } from "svelte";
    import Container from "./Container.svelte";
    import Subtitle from "./typography/Subtitle.svelte";

    interface Props {
        colour?: "primary" | "secondary" | "tertiary";
        children?: Snippet;
        icon: Snippet<[string]>;
        onClick?: () => void;
        smallIcon?: Snippet<[string]>;
        size?: "default" | "large";
    }

    let {
        colour = "primary",
        children,
        onClick,
        icon,
        smallIcon,
        size = "default",
    }: Props = $props();
    let iconColour = $derived(getIconColour());

    function getIconColour() {
        switch (colour) {
            case "primary":
                return ColourVars.primary;
            case "secondary":
                return ColourVars.secondary;
            case "tertiary":
                return ColourVars.tertiary;
        }
    }
</script>

<Container
    width={"hug"}
    crossAxisAlignment={"center"}
    gap={"lg"}
    padding={["xs", "zero"]}
    {onClick}>
    <button class:large={size === "large"} class={`list_action_button ${colour}`} type="button">
        {@render icon(iconColour)}
        {#if smallIcon !== undefined}
            <div class="plus">
                {@render smallIcon(ColourVars.background1)}
            </div>
        {/if}
    </button>
    {#if children}
        <Subtitle ellipsisTruncate fontWeight={"bold"}>{@render children()}</Subtitle>
    {/if}
</Container>

<style lang="scss">
    // This has to be done like this because we can't size using css vars for svg elements for some reason
    :global(.list_action_button > svg) {
        width: var(--icon-md);
        height: var(--icon-md);
    }

    .plus {
        position: absolute;
        background-color: var(--success);
        width: 1rem;
        height: 1rem;
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: var(--rad-sm);
        border: var(--bw-thick) solid var(--background-1);
        bottom: 0;
        right: 0;
        transform: translateX(50%);
    }

    button {
        position: relative;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--rad-md);
        color: var(--text-primary);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;

        &.large {
            width: 3.5rem;
            height: 3.5rem;
            border-radius: var(--rad-lg);
        }

        &.primary {
            background: var(--primary-muted);
        }

        &.secondary {
            background: var(--secondary-muted);
        }

        &.tertiary {
            background: var(--tertiary-muted);
        }
    }
</style>

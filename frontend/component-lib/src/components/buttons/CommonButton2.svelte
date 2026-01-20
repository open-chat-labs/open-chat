<script lang="ts">
    import {
        ButtonRegular,
        ButtonSmall,
        ColourVars,
        Container,
        getFlexStyle,
        type Direction,
        type SizeMode,
    } from "component-lib";
    import { getContext, type Snippet } from "svelte";
    import Spinner from "../Spinner.svelte";

    type Variant = "primary" | "secondary";
    type Mode = "text" | "small" | "regular";

    interface Props {
        children?: Snippet;
        variant?: Variant;
        mode?: Mode;
        disabled?: boolean;
        loading?: boolean;
        onClick?: (e: MouseEvent) => void;
        icon?: Snippet<[string, string]>;
        width?: SizeMode;
        reverse?: boolean;
    }
    let {
        children,
        variant = "primary",
        mode = "text",
        icon,
        disabled = false,
        onClick,
        loading = false,
        width = "hug",
        reverse = false,
    }: Props = $props();

    const SPEED = 250;
    let parentDirection = getContext<Direction>("direction");
    let iconColour = $derived(getIconColour());
    let iconSize = $derived(getIconSize());
    let widthCss = $derived(getFlexStyle("width", width, parentDirection));
    let style = $derived(`--speed: ${SPEED}ms; ${widthCss};`);

    function getIconColour(): string {
        if (disabled) return ColourVars.disabledButton;

        switch (variant) {
            case "primary":
                switch (mode) {
                    case "text":
                        return ColourVars.primary;
                    case "small":
                    case "regular":
                        return ColourVars.textOnPrimary;
                }
            case "secondary":
                return ColourVars.textPrimary;
        }
    }

    function getIconSize() {
        switch (mode) {
            case "regular":
                return "1.5rem";
            case "text":
            case "small":
                return "1.25rem";
        }
    }

    function clickInternal(e: MouseEvent) {
        if (onClick) {
            e.stopPropagation();
            e.preventDefault();
            onClick(e);
        }
    }
</script>

{#snippet icon_view()}
    {#if loading}
        <span class="icon">
            <Spinner size={iconSize} backgroundColour={"var(--text-tertiary)"} />
        </span>
    {:else if icon}
        <span class="icon">{@render icon(iconColour, iconSize)}</span>
    {/if}
{/snippet}

<button
    type="button"
    aria-busy={loading}
    {style}
    class={`common_button_2 ${variant} ${mode} ${icon ? "with-icon" : ""}`}
    class:disabled={disabled || loading}
    onclick={clickInternal}
    disabled={disabled || loading}>
    <Container
        mainAxisAlignment="center"
        crossAxisAlignment="center"
        padding={["sm", "md", "sm", icon ? "sm" : "md"]}
        gap={mode === "regular" ? "md" : "sm"}>
        {#if !reverse}
            {@render icon_view()}
        {/if}
        {#if children}
            {#if mode === "small"}
                <ButtonSmall align={"center"} width={"hug"} fontWeight={"bold"}>
                    {@render children?.()}
                </ButtonSmall>
            {:else}
                <ButtonRegular align={"center"} width={"hug"} fontWeight={"bold"}>
                    {@render children?.()}
                </ButtonRegular>
            {/if}
        {/if}
        {#if reverse}
            {@render icon_view()}
        {/if}
    </Container>
</button>

<style lang="scss">
    :global(.common_button_2 .icon svg path) {
        transition: fill var(--speed) ease-in-out;
    }

    button {
        $speed: var(--speed);
        all: unset;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        border: none;
        border-radius: var(--rad-md);
        cursor: pointer;
        padding: var(--sp-xs) 0;
        transition:
            flex ease-in-out $speed,
            border-radius ease-in-out $speed,
            border ease-in-out $speed,
            background ease-in-out $speed,
            color ease-in-out $speed;

        .content {
            pointer-events: none;
        }

        .icon {
            display: flex;
        }

        &:disabled {
            cursor: not-allowed;
        }

        &.regular {
            border-radius: var(--rad-lg);
        }

        &.primary.regular {
            background: var(--primary);
        }

        &.primary.small,
        &.primary.regular {
            color: var(--text-on-primary);
        }

        &.primary.text {
            color: var(--primary);
        }

        &.primary.text:active {
            color: var(--primary-light);
        }
    }

    :global {
        .common_button_2 {
            &.primary.text:active {
                .icon path {
                    fill: var(--primary-light) !important;
                }
            }
        }
    }
</style>

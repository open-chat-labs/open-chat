<script lang="ts">
    import {
        Body,
        ColourVars,
        getFlexStyle,
        type ColourVarKeys,
        type Direction,
        type SizeMode,
    } from "component-lib";
    import { getContext, onMount, type Snippet } from "svelte";
    import Spinner from "../Spinner.svelte";

    type Mode = "default" | "active";
    type Size = "small_text" | "small" | "medium" | "large";
    type InternalMode = Mode | "pressed";

    interface Props {
        children?: Snippet;
        disabled?: boolean;
        loading?: boolean;
        mode?: Mode;
        size?: Size;
        onClick?: (e: MouseEvent) => void;
        icon?: Snippet<[string, string]>;
        width?: SizeMode;
        height?: SizeMode;
    }
    let {
        children,
        icon,
        disabled = false,
        onClick,
        loading = false,
        mode = "default",
        size = "medium",
        width = { kind: "hug" },
        height = { kind: "hug" },
    }: Props = $props();

    const SPEED = 250;
    let internalMode = $state<InternalMode>("default");
    let parentDirection = getContext<Direction>("direction");
    let spinnerColour = mode === "default" ? "var(--primary)" : "var(--text-on-primary)";
    let iconColour = $derived(getIconColour());
    let iconSize = $derived(getIconSize());
    let textColour = $derived(getTextColour());
    let widthCss = $derived(getFlexStyle("width", width, parentDirection));
    let heightCss = $derived(getFlexStyle("height", height, parentDirection));
    let style = $derived(`--speed: ${SPEED}ms; ${heightCss}; ${widthCss};`);
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

    function getTextColour(): ColourVarKeys {
        switch (internalMode) {
            case "default":
                if (disabled) return "disabledButton";
                switch (size) {
                    case "small_text":
                        return "primary";
                    default:
                        return "textSecondary";
                }
            case "pressed":
                if (disabled) return "disabledButton";
                switch (size) {
                    case "small_text":
                        return "primary";
                    default:
                        return "textPrimary";
                }
            case "active": {
                if (disabled) return "textTertiary";
                switch (size) {
                    case "small":
                    case "small_text":
                        return "primary";
                    default:
                        return "textOnPrimary";
                }
            }
        }
    }

    function getIconColour(): string {
        switch (internalMode) {
            case "default":
                if (disabled) return ColourVars.disabledButton;
                switch (size) {
                    case "small_text":
                        return "var(--primary)";
                    default:
                        return "var(--text-secondary)";
                }
            case "pressed":
                if (disabled) return ColourVars.disabledButton;
                switch (size) {
                    case "small_text":
                        return "var(--primary)";
                    default:
                        return "var(--text-primary)";
                }
            case "active": {
                if (disabled) return ColourVars.textTertiary;
                switch (size) {
                    case "small":
                    case "small_text":
                        return "var(--primary)";
                    default:
                        return "var(--text-on-primary)";
                }
            }
        }
    }

    function getIconSize() {
        switch (size) {
            case "large":
                return "1.4rem";
            case "medium":
                return "1.2rem";
            default:
                return "1.2rem";
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

<button
    type="button"
    aria-busy={loading}
    {style}
    class={`common_button ${internalMode} ${size}`}
    class:disabled={disabled || loading}
    onclick={clickInternal}
    disabled={disabled || loading}>
    {#if loading}
        <span class="icon">
            <Spinner backgroundColour={"var(--text-tertiary)"} foregroundColour={spinnerColour} />
        </span>
    {:else if icon}
        <span class="icon">{@render icon(iconColour, iconSize)}</span>
    {/if}
    {#if children}
        <Body align={"center"} width={{ kind: "hug" }} colour={textColour} fontWeight={"bold"}
            >{@render children?.()}</Body>
    {/if}
</button>

<style lang="scss">
    :global(.common_button .icon svg path) {
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
        cursor: pointer;
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

        &.default {
            border-radius: var(--rad-circle);
            border: var(--bw-thick) solid var(--background-2);
            background: var(--background-1);
            color: var(--text-secondary);

            &.small,
            &.small_text {
                background: transparent;
            }

            &.small_text {
                border: var(--bw-thick) solid transparent;
                color: var(--text-primary);
            }
        }

        &.pressed {
            border-radius: var(--rad-lg);
            border: var(--bw-thick) solid transparent;
            background: var(--background-2);
            color: var(--text-primary);

            &.small_text {
                background: var(--primary-light);
                color: var(--primary);
            }
        }

        &.active {
            border-radius: var(--rad-md);
            border: var(--bw-thick) solid transparent;
            background: var(--primary);
            color: var(--text-on-primary);

            &.small_text {
                background: transparent;
                color: var(--primary);
                border: var(--bw-thick) solid transparent;
            }

            &.small {
                color: var(--primary);
                background: transparent;
                border: var(--bw-thick) solid var(--primary);
            }
        }

        &.small,
        &.small_text {
            border-radius: var(--rad-circle);
            padding: var(--sp-xs) var(--sp-md);
            font-size: var(--typo-bodySmall-sz);
            line-height: 12px;
            gap: var(--sp-xs);
        }

        &.medium {
            padding: var(--sp-md) var(--sp-lg);
            font-size: var(--typo-bodySmall-sz);
            line-height: 12px;
            gap: var(--sp-sm);
            &.default {
                border-radius: var(--rad-circle);
            }
            &.pressed {
                border-radius: var(--rad-lg);
            }
            &.active {
                border-radius: var(--rad-md);
            }
        }

        &.large {
            padding: var(--sp-lg) var(--sp-xl);
            font-size: var(--typo-body-sz);
            line-height: var(--typo-body-lh);
            gap: var(--sp-sm);
            &.default {
                border-radius: var(--rad-circle);
            }
            &.pressed {
                border-radius: var(--rad-lg);
            }
            &.active {
                border-radius: var(--rad-md);
            }
        }

        &.disabled {
            background: var(--disabled-button);
        }

        &:disabled {
            cursor: not-allowed;
        }
    }
</style>

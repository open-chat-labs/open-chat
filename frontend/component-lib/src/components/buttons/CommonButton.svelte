<script lang="ts">
    import { getFlexStyle, type Direction, type SizeMode } from "component-lib";
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
        mode = "default",
        size = "medium",
        width = { kind: "hug" },
        height = { kind: "hug" },
    }: Props = $props();

    const SPEED = 300;
    let internalMode = $state<InternalMode>("default");
    let parentDirection = getContext<Direction>("direction");
    let spinnerColour = mode === "default" ? "var(--primary)" : "var(--text-on-primary)";
    let iconColour = $derived(getIconColour());
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

    function getIconColour(): string {
        switch (internalMode) {
            case "default":
                switch (size) {
                    case "small_text":
                        return "var(--text-primary)";
                    default:
                        return "var(--text-secondary)";
                }
            case "pressed":
                switch (size) {
                    case "small_text":
                        return "var(--primary)";
                    default:
                        return "var(--text-primary)";
                }
            case "active": {
                switch (size) {
                    case "small_text":
                        return "var(--primary)";
                    default:
                        return "var(--primary-light)";
                }
            }
        }
    }
</script>

<button
    type="button"
    aria-busy={loading}
    {style}
    class={`common_button ${internalMode} ${size}`}
    class:disabled
    onclick={onClick}
    disabled={disabled || loading}>
    {#if loading}
        <Spinner
            size={"1.4rem"}
            backgroundColour={"var(--text-tertiary)"}
            foregroundColour={spinnerColour} />
    {:else}
        {#if icon}
            <span class="icon">{@render icon(iconColour)}</span>
        {/if}
        <span class="content"> {@render children?.()}</span>
    {/if}
</button>

<style lang="scss">
    $small_icon: 12px;
    $medium_icon: 16px;
    $large_icon: 18px;

    :global(.common_button .icon svg path) {
        transition: fill var(--speed) ease-in-out;
    }

    :global(.common_button.small .icon svg) {
        width: $small_icon;
        height: $small_icon;
    }

    :global(.common_button.medium .icon svg) {
        width: $medium_icon;
        height: $medium_icon;
    }

    :global(.common_button.large .icon svg) {
        width: $large_icon;
        height: $large_icon;
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
            border-radius ease-in-out $speed,
            border ease-in-out $speed,
            background ease-in-out $speed,
            color ease-in-out $speed;

        font-weight: var(--font-normal);
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

        &.default {
            border-radius: var(--rad-circle);
            border: var(--bw-thin) solid var(--background-2);
            background: var(--background-1);
            color: var(--text-secondary);

            &.small,
            &.small_text {
                background: transparent;
            }

            &.small_text {
                border: var(--bw-thin) solid transparent;
                color: var(--text-primary);
            }
        }

        &.pressed {
            border-radius: var(--rad-lg);
            border: var(--bw-thin) solid transparent;
            background: var(--background-2);
            color: var(--text-primary);

            &.small_text {
                background: var(--primary-light);
                color: var(--primary);
            }
        }

        &.active {
            border-radius: var(--rad-md);
            border: var(--bw-thin) solid transparent;
            background: var(--primary-muted);
            color: var(--primary-light);

            &.small_text {
                background: transparent;
                color: var(--primary);
                border: var(--bw-thin) solid transparent;
            }
        }

        &.small,
        &.small_text {
            padding: var(--sp-sm) var(--sp-md);
            font-size: var(--typo-bodySmall-sz);
            line-height: 12px;
            gap: var(--sp-xs);
            .icon {
                height: $small_icon;
            }
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
            .icon {
                height: $medium_icon;
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
            .icon {
                height: $large_icon;
            }
        }
    }
</style>

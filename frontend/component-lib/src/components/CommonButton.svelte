<script lang="ts">
    import { getFlexStyle, type Direction, type SizeMode } from "component-lib";
    import { getContext, type Snippet } from "svelte";
    import Spinner from "./Spinner.svelte";

    type Mode = "default" | "active" | "pressed";
    type Size = "small" | "medium" | "large";

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

    let parentDirection = getContext<Direction>("direction");
    let spinnerColour = mode === "default" ? "var(--primary)" : "var(--text-on-primary)";
    let iconColour = $derived(getIconColour());
    let widthCss = $derived(getFlexStyle("width", width, parentDirection));
    let heightCss = $derived(getFlexStyle("height", height, parentDirection));
    let style = $derived(`${heightCss}; ${widthCss};`);

    function getIconColour(): string {
        switch (mode) {
            case "default":
                return "var(--text-secondary)";
            case "pressed":
                return "var(--text-primary)";
            case "active": {
                switch (size) {
                    case "small":
                        return "var(--text-on-primary)";
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
    class={`common_button ${mode} ${size}`}
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
        <span class="content">{@render children?.()}</span>
    {/if}
</button>

<style lang="scss">
    $small_icon: 12px;
    $medium_icon: 16px;
    $large_icon: 18px;

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
        all: unset;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        border: none;
        cursor: pointer;
        transition:
            border ease-in-out 200ms,
            background ease-in-out 200ms,
            color ease-in-out 200ms;

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
        }

        &.pressed {
            border-radius: var(--rad-lg);
            border: var(--bw-thin) solid transparent;
        }

        &.active {
            border-radius: var(--rad-md);
            border: var(--bw-thin) solid transparent;
        }

        &.small {
            padding: var(--sp-sm) var(--sp-md);
            font-size: var(--typo-bodySmall-sz);
            line-height: 12px;
            gap: var(--sp-xs);
            &.default {
                background: var(--background-1);
                color: var(--text-secondary);
            }
            &.pressed {
                background: var(--background-2);
                color: var(--text-primary);
            }
            &.active {
                background: var(--primary);
                color: var(--text-on-primary);
            }
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
                background: var(--background-1);
                color: var(--text-secondary);
                border-radius: var(--rad-circle);
            }
            &.pressed {
                background: var(--background-2);
                color: var(--text-primary);
                border-radius: var(--rad-lg);
            }
            &.active {
                background: var(--primary-muted);
                color: var(--primary-light);
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
                background: var(--background-1);
                color: var(--text-secondary);
                border-radius: var(--rad-circle);
            }
            &.pressed {
                background: var(--background-2);
                color: var(--text-primary);
                border-radius: var(--rad-lg);
            }
            &.active {
                background: var(--primary-muted);
                color: var(--primary-light);
                border-radius: var(--rad-md);
            }
            .icon {
                height: $large_icon;
            }
        }
    }
</style>

<script lang="ts">
    import { ColourVars, posToStyle, Spinner, type Pos } from "component-lib";
    import { type Snippet } from "svelte";

    type FabVariant = "primary" | "secondary";

    interface Props {
        onClick?: (e: MouseEvent) => void;
        icon: Snippet<[string]>;
        disabled?: boolean;
        pos?: Pos;
        loading?: boolean;
        variant?: FabVariant;
    }
    let {
        icon,
        onClick,
        disabled = false,
        pos,
        loading = false,
        variant = "primary",
    }: Props = $props();
</script>

<button
    class:disabled={disabled || loading}
    class:primary={variant === "primary"}
    class:secondary={variant === "secondary"}
    style={posToStyle(pos)}
    aria-busy={loading}
    class="floating_button"
    disabled={disabled || loading}
    type="button"
    onclick={onClick}>
    {#if loading}
        <span class="button_icon">
            <Spinner
                backgroundColour={ColourVars.textTertiary}
                foregroundColour={ColourVars.textOnPrimary} />
        </span>
    {:else}
        {@render icon(variant === "primary" ? ColourVars.textOnPrimary : ColourVars.textPrimary)}
    {/if}
</button>

<style lang="scss">
    // This has to be done like this because we can't size using css vars for svg elements for some reason
    :global(.floating_button > svg) {
        width: var(--icon-md);
        height: var(--icon-md);
    }

    button {
        font-size: var(--typo-subtitle-sz);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: var(--shadow-menu);
        transition: background ease-in-out 200ms;

        &.primary {
            width: 3.5rem;
            height: 3.5rem;
            background: var(--primary);
            border-radius: var(--rad-xl);
        }

        &.secondary {
            width: 2rem;
            height: 2rem;
            background: var(--background-2);
            border-radius: var(--rad-circle);
        }

        &.disabled {
            background: var(--button-disabled);
        }

        .button_icon {
            display: flex;
        }
    }
</style>

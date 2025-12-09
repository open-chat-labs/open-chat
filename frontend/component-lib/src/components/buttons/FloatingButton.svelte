<script lang="ts">
    import { ColourVars, posToStyle, Spinner, type Pos } from "component-lib";
    import { type Snippet } from "svelte";

    interface Props {
        onClick?: (e: MouseEvent) => void;
        icon: Snippet<[string]>;
        disabled?: boolean;
        pos?: Pos;
        loading?: boolean;
    }
    let { icon, onClick, disabled = false, pos, loading = false }: Props = $props();
</script>

<button
    class:disabled={disabled || loading}
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
        {@render icon(ColourVars.textOnPrimary)}
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
        width: 3.5rem;
        height: 3.5rem;
        background: var(--primary);
        color: var(--text-primary);
        border-radius: var(--rad-xl);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: var(--shadow-menu);
        transition: background ease-in-out 200ms;

        &.disabled {
            background: var(--button-disabled);
        }

        .button_icon {
            display: flex;
        }
    }
</style>

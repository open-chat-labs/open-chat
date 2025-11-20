<script lang="ts">
    import { ColourVars, type SpacingSize, Spinner, sizeToCssVar } from "component-lib";
    import { type Snippet } from "svelte";

    type Pos = {
        top?: SpacingSize;
        bottom?: SpacingSize;
        left?: SpacingSize;
        right?: SpacingSize;
    };

    interface Props {
        onClick?: (e: MouseEvent) => void;
        icon: Snippet<[string]>;
        disabled?: boolean;
        pos?: Pos;
        loading?: boolean;
    }
    let { icon, onClick, disabled = false, pos, loading = false }: Props = $props();

    function posToStyle(pos?: Pos) {
        if (pos === undefined) return "";
        const keys: (keyof Pos)[] = ["top", "right", "bottom", "left"];
        return keys
            .reduce(
                (res, key) => {
                    const val = pos[key];
                    if (val !== undefined) {
                        res.push(`${key}: ${sizeToCssVar(val)}`);
                    }
                    return res;
                },
                ["position: absolute"] as string[],
            )
            .join("; ");
    }
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

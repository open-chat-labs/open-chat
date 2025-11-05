<script lang="ts">
    import { ColourVars, type SpacingSize, sizeToCssVar } from "component-lib";
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
    }
    let { icon, onClick, disabled = false, pos }: Props = $props();

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

<button style={posToStyle(pos)} class="floating_button" {disabled} type="button" onclick={onClick}>
    {@render icon(ColourVars.textOnPrimary)}
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
    }
</style>

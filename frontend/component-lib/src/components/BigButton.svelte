<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        children?: Snippet;
        style: "default" | "pressed" | "active";
        onClick?: (e: MouseEvent) => void;
        icon: Snippet<[string]>;
    }
    let { children, icon, onClick, style }: Props = $props();

    let iconColour = "var(--primary)";
</script>

<button onclick={onClick} class={`${style}`}>
    <span class="content">{@render children?.()}</span>
    {#if icon}
        <span class="icon">{@render icon(iconColour)}</span>
    {/if}
</button>

<style lang="scss">
    button {
        position: relative;
        background: var(--background-1);
        min-height: 80px; // TOOD - not sure about this
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        border: none;
        border-radius: var(--rad-sm);
        color: var(--text-primary);
        cursor: pointer;
        width: 100%;
        transition:
            background ease-in-out 200ms,
            color ease-in-out 200ms;

        font-weight: 700; // TODO - typography vars (weight semi - bold)
        font-size: 12px; // TODO - typography vars (body small)

        .content {
            pointer-events: none;
        }

        &.disabled {
            background: var(--disabled-button);
        }

        &:disabled {
            cursor: not-allowed;
        }

        .icon {
            position: absolute;
            right: 0;
            top: 50%;
            transform: translateY(-50%) translateX(-50%);
            display: flex;
        }

        &.secondary {
            background: none;
            color: var(--primary);
            border: 1px solid var(--primary);

            &.disabled {
                color: var(--disabled-button);
                border-color: var(--disabled-button);
            }
        }
    }
</style>

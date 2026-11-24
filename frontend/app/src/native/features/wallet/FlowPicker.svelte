<!-- A flow's chooser row (the prototype's Token and To rows): what's chosen, or a placeholder with
     its icon, and a chevron; a tap opens its sheet. -->
<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        /** Shown, with `icon`, while nothing is chosen (translated). */
        placeholder: string;
        /** An icons.js name. */
        icon: string;
        onClick: () => void;
        /** What's chosen; the placeholder without it. */
        children?: Snippet;
    };

    let { placeholder, icon, onClick, children }: Props = $props();
</script>

<button type="button" class="picker" onclick={onClick}>
    {#if children}
        {@render children()}
    {:else}
        <span class="empty-icon" aria-hidden="true"><span class="icon" style:--icon="var(--icon-{icon})"></span></span>
        <span class="placeholder">{placeholder}</span>
    {/if}
    <span class="chevron" aria-hidden="true"></span>
</button>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .picker {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        width: 100%;
        min-height: 64px;
        padding: 10px 14px 10px var(--space-12);
        border: 0;
        border-radius: var(--radius-lg);
        background: var(--overlay-1);
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-2);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .empty-icon {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--overlay-2);
        @include flex-center;
    }

    .icon {
        width: 18px;
        height: 18px;
        background: var(--ink-3);
        mask: var(--icon) center / contain no-repeat;
    }

    .placeholder {
        flex: 1;
        min-width: 0;
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
        color: var(--ink-2);
    }

    .chevron {
        flex: none;
        width: 14px;
        height: 14px;
        margin-inline-start: auto;
        background: var(--ink-4);
        mask: var(--icon-chevron-down) center / contain no-repeat;
    }
</style>

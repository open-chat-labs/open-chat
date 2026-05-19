<script lang="ts">
    import { rtlStore } from "@src/stores/rtl";
    import { MenuItem } from "component-lib";

    export interface SuggestionItem {
        key: string;
        label: string;
        icon?: string;
    }

    interface Props {
        items: SuggestionItem[];
        selectedIndex: number;
        x: number;
        y: number;
        onselect: (key: string) => void;
    }

    let { items, selectedIndex, x, y, onselect }: Props = $props();

    let position = $derived(
        $rtlStore
            ? `right: calc(100vw - ${x}px); bottom: calc(100vh - ${y}px)`
            : `left: ${x}px; bottom: calc(100vh - ${y}px)`,
    );
</script>

{#if items.length > 0}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="popup" style={position} onmousedown={(e) => e.preventDefault()}>
        {#each items as item, i (item.key)}
            <MenuItem selected={i === selectedIndex} onclick={() => onselect(item.key)}>
                {#snippet icon(_color, _size)}
                    {#if item.icon}
                        <span class="item-icon">{item.icon}</span>
                    {/if}
                {/snippet}
                {item.label}
            </MenuItem>
        {/each}
    </div>
{/if}

<style lang="scss">
    .popup {
        position: fixed;
        @include z-index("popup-menu");
        background: var(--surface-1);
        border-radius: var(--rad-xl);
        box-shadow: var(--shadow-menu);
        // padding: var(--sp-sm) 0;
        min-width: 180px;
        max-width: 300px;
        overflow: hidden;
    }

    .item-icon {
        font-size: 1.4rem;
        line-height: 1;
    }
</style>

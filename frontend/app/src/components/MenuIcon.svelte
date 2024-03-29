<script lang="ts">
    import { onDestroy } from "svelte";
    import { menuStore } from "../stores/menu";
    import { tick } from "svelte";
    import type { Alignment, Position } from "../utils/alignment";

    export let centered = false;
    export let position: Position = "bottom";
    export let align: Alignment = "middle";
    export let gutter = 8;

    let menu: HTMLElement;
    let contextMenu: HTMLElement;

    $: open = $menuStore === contextMenu;

    onDestroy(closeMenu);

    export async function showMenu() {
        if ($menuStore === contextMenu) {
            menuStore.hideMenu();
        } else {
            menuStore.showMenu(contextMenu);

            await tick();

            menuStore.position(menu, centered, position, align, gutter);
        }
    }

    async function onShowMenu(e: MouseEvent): Promise<void> {
        e.preventDefault();
        await showMenu();
    }

    function closeMenu() {
        menuStore.hideMenu();
    }
</script>

<div class:open class="menu-icon" bind:this={menu} on:click|stopPropagation={onShowMenu}>
    <slot name="icon" />
</div>

<div class="menu-blueprint">
    <span class="menu" bind:this={contextMenu} on:click|stopPropagation={closeMenu}>
        {#if open}
            <slot name="menu" />
        {/if}
    </span>
</div>

<style lang="scss">
    :global(.menu-icon.open path) {
        fill: var(--icon-selected);
    }

    .menu {
        position: fixed;
        @include z-index("popup-menu");
    }

    .menu-blueprint {
        display: none;
    }
</style>

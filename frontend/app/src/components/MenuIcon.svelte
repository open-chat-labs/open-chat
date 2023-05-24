<script lang="ts">
    import { onDestroy } from "svelte";
    import { menuStore } from "../stores/menu";
    import { tick } from "svelte";
    import type { Alignment, Position } from "../utils/alignment";

    export let centered = false;
    export let position: Position = "bottom";
    export let align: Alignment = "center";
    export let gutter = 8;

    let menu: HTMLElement;
    let contextMenu: HTMLElement;

    $: open = $menuStore === contextMenu;

    onDestroy(closeMenu);

    async function showMenu(e: MouseEvent): Promise<void> {
        e.preventDefault();
        if ($menuStore === contextMenu) {
            menuStore.hideMenu();
        } else {
            const rect = menu.getBoundingClientRect();
            menuStore.showMenu(contextMenu);

            await tick();

            menuStore.position(rect, centered, position, align, gutter);
        }
    }

    function closeMenu() {
        menuStore.hideMenu();
    }
</script>

<div class:open class="menu-icon" bind:this={menu} on:click|stopPropagation={showMenu}>
    <slot name="icon" />
</div>

<div class="menu-blueprint">
    <span class="menu" bind:this={contextMenu} on:click|stopPropagation={closeMenu}>
        {#if open}
            <slot name="menu" />
        {/if}
    </span>
</div>

<svelte:body on:click={closeMenu} />
<svelte:window on:resize={closeMenu} on:orientationchange={closeMenu} />

<style type="text/scss">
    :global(.menu-icon.open path) {
        fill: var(--icon-selected);
    }

    .menu {
        position: absolute;
        @include z-index("popup-menu");
    }

    .menu-blueprint {
        display: none;
    }
</style>

<script lang="ts">
    import { menuStore } from "../stores/menu";
    import { onMount } from "svelte";

    let menu: HTMLElement;
    let contextMenu: HTMLElement;

    async function showMenu(_e: MouseEvent): Promise<void> {
        if ($menuStore === contextMenu) {
            menuStore.hideMenu();
        } else {
            const rect = menu.getBoundingClientRect();
            menuStore.showMenu(contextMenu, rect);
        }
    }

    onMount(() => {
        window.addEventListener("orientationchange", closeMenu);
    });

    function closeMenu() {
        menuStore.hideMenu();
    }
</script>

<div class="menu-icon" bind:this={menu} on:click|stopPropagation={showMenu}>
    <slot name="icon" />
</div>

<div class="blueprint">
    <span class="menu" bind:this={contextMenu} on:click|stopPropagation={closeMenu}>
        {#if $menuStore === contextMenu}
            <slot name="menu" />
        {/if}
    </span>
</div>

<svelte:body on:click={closeMenu} />
<svelte:window on:resize={closeMenu} />

<style type="text/scss">
    .menu {
        position: absolute;
    }

    .blueprint {
        display: none;
    }
</style>

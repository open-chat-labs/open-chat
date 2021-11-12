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

<div class="menu-icon">
    <span bind:this={menu} on:click|stopPropagation={showMenu}>
        <slot name="icon" />
    </span>
</div>

<div class="blueprint">
    <span class="menu" bind:this={contextMenu} on:click|stopPropagation={closeMenu}>
        <slot name="menu" />
    </span>
</div>

<svelte:body on:click={closeMenu} />
<svelte:window on:resize={closeMenu} />

<style type="text/scss">
    .menu-icon {
        position: relative;
    }
    .menu {
        position: absolute;
        // display: none;
    }

    .blueprint {
        visibility: hidden;
    }
</style>

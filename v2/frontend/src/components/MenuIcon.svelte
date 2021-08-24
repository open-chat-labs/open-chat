<script lang="ts">
    import { rtlStore } from "../stores/rtl";
    import { menuStore } from "../stores/menu";

    let pos: { x: number; y: number } | undefined;
    let menu: HTMLElement;

    async function showMenu(_e: MouseEvent): Promise<void> {
        if (pos) {
            closeMenu();
        }
        const l = $rtlStore ? 150 : -150;
        pos = { x: menu.offsetLeft + l, y: menu.offsetTop + 40 };
        menuStore.showMenu(menu);
    }

    function closeMenu() {
        pos = undefined;
        menuStore.hideMenu();
    }
</script>

<div class="menu-icon">
    <span bind:this={menu} on:click|stopPropagation={showMenu}>
        <slot name="icon" />
    </span>

    {#if pos && $menuStore === menu}
        <span
            class="menu"
            style={`top: ${pos.y}px; left: ${pos.x}px`}
            on:click|stopPropagation={closeMenu}>
            <slot name="menu" />
        </span>
    {/if}
</div>

<svelte:body on:click={closeMenu} />
<svelte:window on:resize={closeMenu} />

<style type="text/scss">
    .menu-icon {
        position: relative;
    }
    .menu {
        position: absolute;
    }
</style>

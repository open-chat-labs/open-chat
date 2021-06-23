<script lang="ts">
    import { rtlStore } from "../stores/rtl";

    let pos: { x: number; y: number } | undefined;
    let menu: HTMLElement;

    function showMenu(e: MouseEvent): void {
        if (pos) {
            return closeMenu();
        }
        const l = $rtlStore ? 150 : -150;
        pos = { x: menu.offsetLeft + l, y: menu.offsetTop + 40 };
    }

    function closeMenu() {
        pos = undefined;
    }
</script>

<div class="menu-icon">
    <span bind:this={menu} on:click|stopPropagation={showMenu}>
        <slot name="icon" />
    </span>

    {#if pos}
        <span class="menu" style={`top: ${pos.y}px; left: ${pos.x}px`}>
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

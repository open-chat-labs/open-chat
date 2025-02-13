<script lang="ts">
    import { onDestroy, type Snippet } from "svelte";
    import { menuStore } from "../stores/menu";
    import type { Alignment, Position } from "../utils/alignment";

    interface Props {
        centered?: boolean;
        position?: Position;
        align?: Alignment;
        gutter?: number;
        menuIcon: Snippet;
        menuItems: Snippet;
    }

    let {
        centered = false,
        position = "bottom",
        align = "middle",
        gutter = 8,
        menuIcon,
        menuItems,
    }: Props = $props();

    let menu: HTMLElement;
    let contextMenu: HTMLElement;
    let open = $state(false);

    $effect(() => {
        open = $menuStore === contextMenu;
    });

    onDestroy(() => menuStore.hideMenu());

    export async function showMenu() {
        if (menu === undefined || contextMenu === undefined) return;

        if ($menuStore === contextMenu) {
            menuStore.hideMenu();
        } else {
            menuStore.showMenu(contextMenu);
            menuStore.position(menu, centered, position, align, gutter);
        }
    }

    async function onShowMenu(e: MouseEvent): Promise<void> {
        e.preventDefault();
        e.stopPropagation();
        await showMenu();
    }

    function closeMenu(e: Event) {
        e.stopPropagation();
        menuStore.hideMenu();
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class:open class="menu-icon" bind:this={menu} onclick={onShowMenu}>
    {@render menuIcon()}
</div>

<div class="menu-blueprint">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span class="menu" bind:this={contextMenu} onclick={closeMenu}>
        {@render menuItems()}
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

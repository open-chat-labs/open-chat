<script lang="ts">
    import { getAllContexts, mount, onDestroy, type Snippet } from "svelte";
    import type { Alignment, Position } from "../utils/alignment";
    import MenuWrapper from "./portal/MenuWrapper.svelte";
    import { portalState } from "./portalState.svelte";

    interface Props {
        centered?: boolean;
        position?: Position;
        align?: Alignment;
        gutter?: number;
        menuIcon?: Snippet;
        menuItems?: Snippet;
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
    let open = $state(false);

    const context = getAllContexts();

    onDestroy(() => portalState.close());

    export function showMenu() {
        internalShowMenu();
    }

    function click(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        internalShowMenu();
    }

    function internalShowMenu() {
        portalState.open(
            mount(MenuWrapper, {
                target: document.body,
                props: {
                    children: menuItems,
                    onClose: internalHideMenu,
                    trigger: menu,
                    centered,
                    position,
                    align,
                    gutter,
                },
                context,
            }),
        );
        open = true;
    }

    function internalHideMenu() {
        portalState.close();
        open = false;
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class:open class="menu-icon" bind:this={menu} onclick={click}>
    {@render menuIcon?.()}
</div>

<style lang="scss">
    :global(.menu-icon.open path) {
        fill: var(--icon-selected);
    }
</style>

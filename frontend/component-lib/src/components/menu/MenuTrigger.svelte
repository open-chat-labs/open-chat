<script lang="ts">
    import { portalState, type Alignment, type Position } from "component-lib";
    import { getAllContexts, mount, onDestroy, type Snippet } from "svelte";
    import Menu from "./Menu.svelte";
    import MenuWrapper from "./MenuWrapper.svelte";

    interface Props {
        centered?: boolean;
        position?: Position;
        align?: Alignment;
        gutter?: number;
        children: Snippet;
        menuItems: Snippet;
    }

    let { children, menuItems, ...rest }: Props = $props();

    let menu: HTMLElement;
    let open = $state(false);

    const context = getAllContexts();

    onDestroy(closeMenu);

    function click(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (open) {
            closeMenu();
        } else {
            showMenu();
        }
    }

    export function showMenu() {
        open = portalState.open(
            mount(MenuWrapper, {
                target: document.body,
                props: {
                    children: wrappedMenuItems,
                    onClose: closeMenu,
                    trigger: menu,
                    ...rest,
                },
                context,
            }),
            closeMenu,
        );
    }

    function closeMenu() {
        open = portalState.close();
    }
</script>

{#snippet wrappedMenuItems()}
    <Menu>
        {@render menuItems()}
    </Menu>
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class:open class="menu-trigger" bind:this={menu} onclick={click}>
    {@render children()}
</div>

<style lang="scss">
    :global(.menu-trigger.open path) {
        fill: var(--primary);
    }
</style>

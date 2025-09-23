<script lang="ts">
    import {
        isTouchDevice,
        longpress,
        portalState,
        type Alignment,
        type Position,
    } from "component-lib";
    import { getAllContexts, mount, onDestroy, type Snippet } from "svelte";
    import Menu from "./Menu.svelte";
    import MenuWrapper from "./MenuWrapper.svelte";

    type MobileMode = "longpress" | "tap";

    interface Props {
        classString?: string;
        centered?: boolean;
        position?: Position;
        align?: Alignment;
        gutter?: number;
        children: Snippet;
        menuItems: Snippet;
        mobileMode?: MobileMode;
        disabled?: boolean;
    }

    let props: Props = $props();
    let mobileMode = $derived(props.mobileMode ?? "tap");
    let menuItems = $derived(props.menuItems);
    let children = $derived(props.children);
    let disabled = $derived(props.disabled);

    let menu: HTMLElement;
    let open = $state(false);
    let useLongpress = $derived(mobileMode === "longpress" && isTouchDevice);

    const context = getAllContexts();

    onDestroy(closeMenu);

    function click(e: MouseEvent | TouchEvent) {
        if (disabled) return;

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
                    ...props,
                    children: wrappedMenuItems,
                    onClose: closeMenu,
                    trigger: menu,
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

{#if useLongpress}
    <div
        class:open
        class={`menu-trigger noselect ${props.classString}`}
        bind:this={menu}
        use:longpress={click}>
        {@render children()}
    </div>
{:else}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class:open class={`menu-trigger ${props.classString}`} bind:this={menu} onclick={click}>
        {@render children()}
    </div>
{/if}

<style lang="scss">
    :global(.menu-trigger.open path) {
        fill: var(--primary);
    }

    .menu-trigger {
        cursor: pointer;
        &.noselect {
            user-select: none;
        }
    }
</style>

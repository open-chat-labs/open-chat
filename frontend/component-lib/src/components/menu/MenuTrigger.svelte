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
        fill?: boolean;
        maskUI?: boolean;
        constrainMask?: string;
    }

    let props: Props = $props();
    let mobileMode = $derived(props.mobileMode ?? "tap");
    let menuItems = $derived(props.menuItems);
    let children = $derived(props.children);
    let disabled = $derived(props.disabled);
    let fill = $derived(props.fill ?? false);
    let maskUI = $derived(props.maskUI ?? false);

    let menu: HTMLElement;
    let open = $state(false);
    let useLongpress = $derived(mobileMode === "longpress" && isTouchDevice);
    let menuClone = $state<HTMLElement>();

    const context = getAllContexts();

    onDestroy(closeMenu);

    function click(e: MouseEvent | TouchEvent) {
        if (disabled) return;

        e.stopPropagation();
        if (open) {
            closeMenu();
        } else {
            showMenu();
        }
    }

    export function showMenu() {
        if (!menu) {
            console.log("Menu is not defined");
            return;
        }
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
        if (maskUI) {
            activateMask();
        }
    }

    function closeMenu() {
        open = portalState.close();
        menuClone?.remove();
        let overlay = document.getElementById("masked_overlay");
        if (overlay) {
            overlay.classList.remove("visible");
        }
    }

    function activateMask() {
        let overlay = document.getElementById("masked_overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "masked_overlay";
            document.body.appendChild(overlay);
        }
        overlay.classList.add("visible");

        menuClone = menu.cloneNode(true) as HTMLElement;
        const sourceRect = menu.getBoundingClientRect();
        let parent = document.body;
        let { top, left } = sourceRect;
        if (props.constrainMask !== undefined) {
            parent = document.getElementById(props.constrainMask) ?? document.body;
        }
        const parentRect = parent.getBoundingClientRect();
        top = sourceRect.top - parentRect.top + parent.scrollTop;
        left = sourceRect.left - parentRect.left + parent.scrollLeft;

        menuClone.addEventListener("contextmenu", (e) => e.preventDefault());
        menuClone.classList.add("menu_trigger_clone");
        menuClone.style.cssText = `
                position: absolute;
                left: ${left}px;
                top: ${top}px;
                width: ${sourceRect.width}px;
                height: ${sourceRect.height}px;
                transition: opacity 200ms ease-in-out;
                margin: 0;
                z-index: 91;
                pointer-events: auto;
                opacity: 0.8;
            `;

        parent.appendChild(menuClone);
        setTimeout(() => {
            if (menuClone !== undefined) {
                menuClone.style.opacity = "1";
            }
        }, 0);
    }
</script>

{#snippet wrappedMenuItems()}
    <Menu centered={props.centered}>
        {@render menuItems()}
    </Menu>
{/snippet}

{#if useLongpress}
    <div
        class:fill
        class:open
        class={`menu-trigger noselect ${props.classString}`}
        bind:this={menu}
        use:longpress={click}>
        {@render children()}
    </div>
{:else}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class:fill
        class:open
        class={`menu-trigger ${props.classString}`}
        bind:this={menu}
        onclick={click}>
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
        &.fill {
            width: 100%;
        }
    }
</style>

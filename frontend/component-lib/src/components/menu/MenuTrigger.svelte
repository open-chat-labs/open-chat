<script lang="ts">
    import {
        isTouchDevice,
        longpress,
        portalState,
        type LongpressAnimation,
        type Alignment,
        type Position,
    } from "component-lib";
    import { getAllContexts, mount, onDestroy, type Snippet, tick } from "svelte";
    import Menu from "./Menu.svelte";
    import MenuWrapper from "./MenuWrapper.svelte";

    // TODO expand this into discriminated union (with kind property) to allow
    // additional longpress props to be attached directly with mode.
    type MobileMode = "longpress" | "tap";

    // This value is actually defined in global.scss!
    const OVERLAY_FADEOUT_DURATION = 250;

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
        longpressAnimation?: LongpressAnimation;
        longpressCooldown?: boolean;
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

    const rectRegistry = new WeakMap<HTMLElement, DOMRect>();
    const styleRegistry = new WeakMap<HTMLElement, string>();

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
        activateMask(maskUI);
    }

    function closeMenu() {
        open = portalState.close();

        resetNodes();

        let overlay = document.getElementById("masked_overlay");
        if (overlay) {
            overlay.classList.remove("visible");
            overlay.classList.remove("active");
        }
    }

    function activateMask(opaque: boolean = true) {
        let overlay = document.getElementById("masked_overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "masked_overlay";
            document.body.appendChild(overlay);
        }
        overlay.classList.add("active");

        if (opaque) {
            // Create menu clone if one is not set. This would be in case the
            // scaling animation is disabled, or compatibility mode where
            // only the longpress handler is provided.
            if (!menuClone) cloneNode();

            // Get menu rect bounds, it was set within the cloneNode
            const sourceRect = rectRegistry.get(menu);

            if (menuClone && sourceRect) {
                const { parent, left, top, width, height } = calcRectValues(sourceRect);

                overlay.classList.add("visible");
                menu.classList.add("menu_trigger_clone");

                // Insert cloned node, and keep the original node in memory!
                menu.parentElement?.insertBefore(menuClone, menu);
                menu.remove();

                // Apply custom styling to the menu...
                Object.assign(menu.style, {
                    position: "absolute",
                    top: `${top}px`,
                    left: `${left}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    margin: 0,
                    zIndex: 91,
                    pointerEvents: "auto",
                });

                // ... and re-attach within the overlay!
                parent.appendChild(menu);
            }
        }
    }

    function cloneNode() {
        menuClone = menu.cloneNode(true) as HTMLElement;
        menuClone.style.visibility = "hidden";

        // Prevents context menu from opening
        menu.addEventListener("contextmenu", (e) => e.preventDefault());

        const sourceRect = menu.getBoundingClientRect();
        const styleVals = menu.style.cssText;

        // Save rect properties
        rectRegistry.set(menu, sourceRect);
        styleRegistry.set(menu, styleVals);
    }

    function resetNodes() {
        menu.classList.add("collapse");
        setTimeout(() => {
            if (!menuClone) return;

            // Restore the menu item looks...
            menu.remove();
            menu.style.cssText = styleRegistry.get(menu) ?? "";
            menu.classList.remove("collapse", "menu_trigger_clone");

            // insert menu to its previous place...
            menuClone.parentElement?.insertBefore(menu, menuClone);

            // Remove menu clone!
            menuClone?.remove();
            menuClone = undefined;
        }, OVERLAY_FADEOUT_DURATION);
    }

    function calcRectValues(sourceRect: DOMRect) {
        const parent = getParentElement();
        const parentRect = parent.getBoundingClientRect();

        return {
            parent,
            top: sourceRect.top - parentRect.top + parent.scrollTop,
            left: sourceRect.left - parentRect.left + parent.scrollLeft,
            width: sourceRect.width,
            height: sourceRect.height,
        };
    }

    function getParentElement() {
        return props.constrainMask
            ? document.getElementById(props.constrainMask) ?? document.body
            : document.body;
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
        use:longpress={{
            onlongpress: click,
            onpressactive: cloneNode,
            animation: props.longpressAnimation,
            cooldown: props.longpressCooldown,
        }}>
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

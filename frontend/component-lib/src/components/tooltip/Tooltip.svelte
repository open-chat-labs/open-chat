<script lang="ts">
    import { longpress, portalState, type Alignment, type Position } from "component-lib";
    import { getAllContexts, mount, onDestroy, type Snippet } from "svelte";
    import TooltipPopup from "./TooltipPopup.svelte";

    interface Props {
        enable?: boolean;
        position?: Position;
        align?: Alignment;
        children: Snippet;
        popup: Snippet;
        uppercase?: boolean;
        autoWidth?: boolean;
        textLength?: number;
        longestWord?: number;
    }

    let props: Props = $props();
    let popup = $derived(props.popup);
    let children = $derived(props.children);

    let tooltip: HTMLElement;
    let open = $state(false);

    const context = getAllContexts();

    onDestroy(closeTooltip);

    function click(e: MouseEvent | TouchEvent) {
        if (!props.enable === false) return;

        e.stopPropagation();
        if (open) {
            closeTooltip();
        } else {
            showTooltip();
        }
    }

    export function showTooltip() {
        open = portalState.open(
            mount(TooltipPopup, {
                target: document.body,
                props: {
                    ...props,
                    children: popup,
                    onClose: closeTooltip,
                    trigger: tooltip,
                },
                context,
            }),
            closeTooltip,
        );
    }

    function closeTooltip() {
        open = portalState.close();
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div class="tooltip_wrapper" class:open bind:this={tooltip} use:longpress={click}>
    {@render children()}
</div>

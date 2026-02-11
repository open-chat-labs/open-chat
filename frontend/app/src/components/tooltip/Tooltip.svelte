<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import type { Alignment, Position } from "component-lib";
    import { portalState } from "component-lib";
    import { getAllContexts, mount, onDestroy, type Snippet } from "svelte";
    import Hoverable from "../Hoverable.svelte";
    import TooltipPopup from "../portal/TooltipPopup.svelte";

    interface Props {
        enable?: boolean;
        position?: Position;
        align?: Alignment;
        fill?: boolean;
        gutter?: number;
        longPressed?: boolean;
        children: Snippet;
        popupTemplate: Snippet;
        autoWidth?: boolean;
        textLength?: number;
        longestWord?: number;
        uppercase?: boolean;
    }

    let {
        enable = true,
        fill = false,
        longPressed = $bindable(false),
        children,
        popupTemplate,
        ...rest
    }: Props = $props();

    let target: Hoverable;
    let hovering: boolean = $state(false);

    const context = getAllContexts();
    let show = $derived(enable && (hovering || longPressed));

    trackedEffect("tooltip", () => {
        if (show) {
            showTooltip();
        } else {
            portalState.close();
        }
    });

    onDestroy(() => portalState.close());

    async function showTooltip(): Promise<void> {
        const trigger = target.getDomElement();
        if (trigger !== undefined) {
            portalState.open(
                mount(TooltipPopup, {
                    target: document.body,
                    props: {
                        children: popupTemplate,
                        onClose: () => portalState.close(),
                        trigger,
                        ...rest,
                    },
                    context,
                }),
            );
        }
    }
</script>

<Hoverable {fill} bind:this={target} bind:hovering bind:longPressed enableLongPress>
    {@render children()}
</Hoverable>

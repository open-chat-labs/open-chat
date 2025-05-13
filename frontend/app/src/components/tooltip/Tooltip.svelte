<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { getAllContexts, mount, onDestroy, tick, type Snippet } from "svelte";
    import type { Alignment, Position } from "../../utils/alignment";
    import Hoverable from "../Hoverable.svelte";
    import TooltipWrapper from "../portal/TooltipWrapper.svelte";
    import { portalState } from "../portalState.svelte";

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
        position = "top",
        align = "start",
        fill = false,
        gutter = 8,
        longPressed = $bindable(false),
        children,
        popupTemplate,
        autoWidth = false,
        textLength = 100,
        longestWord = 10,
        uppercase = false,
    }: Props = $props();

    let target: Hoverable;
    let hovering: boolean = $state(false);

    const context = getAllContexts();
    let show = $derived(enable && (hovering || longPressed));

    trackedEffect("tooltip", () => {
        if (show) {
            showTooltip();
        } else {
            closeTooltip();
        }
    });

    onDestroy(closeTooltip);

    async function showTooltip(): Promise<void> {
        await tick();

        const trigger = target.getDomElement();
        if (trigger !== undefined) {
            const props = {
                children: popupTemplate,
                onClose: closeTooltip,
                trigger,
                position,
                align,
                gutter,
                autoWidth,
                textLength,
                longestWord,
                uppercase,
            };
            portalState.open(
                mount(TooltipWrapper, {
                    target: document.body,
                    props,
                    context,
                }),
            );
        }
    }

    function closeTooltip() {
        portalState.close();
    }
</script>

<Hoverable {fill} bind:this={target} bind:hovering bind:longPressed enableLongPress>
    {@render children()}
</Hoverable>

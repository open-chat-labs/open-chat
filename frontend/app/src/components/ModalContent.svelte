<script lang="ts">
    import { createEventDispatcher, onMount, tick } from "svelte";
    import { fade } from "svelte/transition";
    import Link from "./Link.svelte";
    import { rtlStore } from "../stores/rtl";
    import { logger } from "../utils/logging";
    import { mobileWidth } from "../stores/screenDimensions";

    const dispatch = createEventDispatcher();

    export let fill: boolean = false;
    export let large: boolean = false;
    export let hideHeader: boolean = false;
    export let hideFooter: boolean = false;
    export let compactFooter: boolean = false;
    export let fadeDuration = 100;
    export let fadeDelay = 200;
    export let fixedWidth: boolean = true;
    export let fitToContent: boolean = false;
    export let alignTo: DOMRect | undefined = undefined;
    export let actualWidth: number = 0;

    let divElement: HTMLElement;

    $: useAlignTo = alignTo !== undefined && !$mobileWidth;
    $: style = useAlignTo ? "visibility: hidden;" : "visibility: visible;";

    onMount(async () => {
        try {
            if (useAlignTo) {
                await tick();
                calculatePosition();
            }
        } catch (e: any) {
            logger.error("Failed to open modal", e);
            onClose();
        }
    });

    function calculatePosition() {
        if (alignTo !== undefined) {
            let modalRect = divElement.getBoundingClientRect();
            let top = Math.min(alignTo.top - 8, window.innerHeight - (modalRect.height + 10));

            style = `position: absolute; visibility: visible; top: ${top}px; `;

            if ($rtlStore) {
                style += `right: ${window.innerWidth - alignTo.left + 8}px;`;
            } else {
                style += `left: ${alignTo.right + 8}px;`;
            }
        }
    }

    function onClose() {
        dispatch("close");
    }
</script>

<div
    bind:this={divElement}
    bind:clientWidth={actualWidth}
    {style}
    class="modal-content"
    class:large
    in:fade={{ duration: fadeDuration, delay: fadeDelay }}
    out:fade={{ duration: fadeDuration }}
    class:fixed-width={fixedWidth}
    class:fit_to_content={fitToContent}
    on:click|stopPropagation>
    {#if !hideHeader}
        <div class="header">
            <h4>
                <slot name="header" />
            </h4>
        </div>
    {/if}
    <div class="body" class:fill>
        <slot name="body" />
    </div>
    {#if !hideFooter}
        <div class="footer" class:rtl={$rtlStore} class:compact={compactFooter}>
            <slot name="footer">
                <Link on:click={onClose}>Close</Link>
            </slot>
        </div>
    {/if}
</div>

<style type="text/scss">
    .modal-content {
        @include font-size(fs-100);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background: var(--modal-bg);
        border: var(--modal-bd);
        border-radius: $sp4;

        @include mobile() {
            &:not(.fit_to_content) {
                width: 100%;
                max-height: calc(100% - 20px);
                border-radius: $sp4 $sp4 0 0;
            }
        }
        @include size-above(sm) {
            &.fixed-width {
                width: 60%;
            }
            &:not(.fit_to_content) {
                max-width: 576px;
            }
            &.large {
                &.fixed-width {
                    width: 90%;
                }
                max-height: 90%;
                max-width: 850px;
            }
        }
    }
    .header {
        @include font(bold, normal, fs-130, 29);
        padding: $sp4 $sp5;
        @include mobile() {
            @include font(bold, normal, fs-120, 29);
            padding: $sp3 $sp4;
            border-radius: $sp4 $sp4 0 0;
        }
    }

    .body {
        flex: 1;
        padding: $sp4 $sp5;
        overflow-y: auto;
        @include nice-scrollbar();

        &.fill {
            padding: 0;
        }

        @include mobile() {
            padding: $sp3 $sp4;
        }
    }
    .footer {
        padding: $sp4 $sp5;
        &.compact {
            padding: $sp3 $sp4;
        }
        text-align: right;
        @include mobile() {
            padding: $sp3 $sp4;
            border-radius: 0;
        }
        &.rtl {
            text-align: left;
        }
    }
</style>

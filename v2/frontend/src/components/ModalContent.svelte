<script lang="ts">
    import { createEventDispatcher, onMount, tick } from "svelte";
    import { fade } from "svelte/transition";
    import Link from "./Link.svelte";
    import { rtlStore } from "../stores/rtl";
    import { rollbar } from "../utils/logging";

    const dispatch = createEventDispatcher();

    export let fill: boolean = false;
    export let large: boolean = false;
    export let hideHeader: boolean = false;
    export let hideFooter: boolean = false;
    export let compactFooter: boolean = false;
    export let fadeDuration = 100;
    export let fadeDelay = 200;
    export let fixedWidth: boolean = true;
    export let alignTo: DOMRect | undefined = undefined;

    let divElement: HTMLElement;

    $: style = alignTo === undefined ? "visibility: visible;" : "visibility: hidden;";

    onMount(async () => {
        try {
            if (alignTo !== undefined) {
                await tick();
                calculatePosition();
            }
        } catch (e: any) {
            rollbar.error("Failed to open modal", e);
            onClose();
        }
    });

    function calculatePosition() {
        if (alignTo !== undefined) {
            let modalRect = divElement.getBoundingClientRect();
            let top = Math.min(alignTo.top - 8, window.innerHeight - modalRect.height);

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
    {style}
    class="modal-content"
    class:large
    in:fade={{ duration: fadeDuration, delay: fadeDelay }}
    out:fade={{ duration: fadeDuration }}
    class:fixed-width={fixedWidth}
    on:click|stopPropagation>
    {#if !hideHeader}
        <div class="header">
            <h3>
                <slot name="header" />
            </h3>
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
        background-color: var(--modal-bg);
        color: var(--modal-txt);
        box-shadow: var(--modal-sh);
        @include size-below(xs) {
            width: 100%;
            max-height: calc(100% - 20px);
            border-radius: $sp4 $sp4 0 0;
        }
        @include size-above(xs) {
            &.fixed-width {
                width: 60%;
            }
            max-width: 576px;
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
        @include font(bold, normal, fs-140);
        padding: $sp4;
        background-color: var(--modal-header-bg);
        color: var(--modal-header-txt);
        border-bottom: 1px solid var(--modal-header-bd);
        @include size-below(xs) {
            border-radius: $sp4 $sp4 0 0;
        }
    }

    .body {
        flex: 1;
        padding: $sp4;
        overflow-y: auto;
        @include nice-scrollbar();

        &.fill {
            padding: 0;
        }
    }
    .footer {
        padding: $sp4;
        &.compact {
            padding: $sp3 $sp4;
        }
        background-color: var(--modal-footer-bg);
        color: var(--modal-footer-txt);
        border-top: 1px solid var(--modal-footer-bd);
        text-align: right;
        @include size-below(xs) {
            border-radius: 0;
        }
        &.rtl {
            text-align: left;
        }
    }
</style>

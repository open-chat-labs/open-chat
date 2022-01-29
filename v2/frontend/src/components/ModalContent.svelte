<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { fade } from "svelte/transition";
    import Link from "./Link.svelte";
    import { rtlStore } from "../stores/rtl";

    const dispatch = createEventDispatcher();

    export let fill: boolean = false;
    export let large: boolean = false;
    export let hideHeader: boolean = false;
    export let hideFooter: boolean = false;
    export let compactFooter: boolean = false;
    export let fixedWidth: boolean = true;
    export let style = "";
</script>

<div
    {style}
    class="modal-content"
    class:large
    class:fixed-width={fixedWidth}
    in:fade={{ duration: 100, delay: 200 }}
    out:fade={{ duration: 100 }}
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
                <Link on:click={() => dispatch("close")}>Close</Link>
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
            max-height: 100%;
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

<script lang="ts">
    import { fade } from "svelte/transition";
    import Button from "./Button.svelte";
    import Link from "./Link.svelte";
    import { modalStore } from "../stores/modal";
    import { rtlStore } from "../stores/rtl";
</script>

<div
    class="modal-content"
    in:fade={{ duration: 100, delay: 200 }}
    out:fade={{ duration: 100 }}
    on:click|stopPropagation>
    <div class="header">
        <h3>
            <slot name="header" />
        </h3>
    </div>
    <div class="body">
        <slot name="body" />
    </div>
    <div class="footer" class:rtl={$rtlStore}>
        <slot name="footer">
            <Link on:click={modalStore.hideModal}>Close</Link>
        </slot>
    </div>
</div>

<style type="text/scss">
    .modal-content {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border-radius: $sp4;
        background-color: var(--modal-bg);
        color: var(--modal-txt);
        box-shadow: var(--modal-sh);
        width: 50%;
        max-width: 576px;
        @include size-below(xs) {
            width: 100%;
            border-radius: $sp4 $sp4 0 0;
        }
    }
    .header {
        @include font(bold, normal, fs-140);
        padding: $sp4;
        border-radius: $sp4 $sp4 0 0;
        background-color: var(--modal-header-bg);
        color: var(--modal-header-txt);
        border-bottom: 1px solid var(--modal-header-bd);
    }
    .body {
        flex: 1;
        padding: $sp6 $sp4;
    }
    .footer {
        padding: $sp4;
        background-color: var(--modal-footer-bg);
        color: var(--modal-footer-txt);
        border-top: 1px solid var(--modal-footer-bd);
        border-radius: 0 0 $sp4 $sp4;
        text-align: right;
        @include size-below(xs) {
            border-radius: 0;
        }
        &.rtl {
            text-align: left;
        }
    }
</style>

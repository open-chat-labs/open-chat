<script lang="ts">
    import { modalStore } from "../stores/modal";
    import { onMount, onDestroy } from "svelte";

    export let active: boolean;
    let ref: HTMLElement;
    let portal: HTMLElement;

    /**
     * This acts like a portal i.e. where ever it is rendered in component hierarchy it will
     * attatch itself to the body of the document. This is what we want for a modal.
     */

    onMount(() => {
        portal = document.createElement("div");
        portal.className = "portal";
        document.body.appendChild(portal);
        portal.appendChild(ref);
    });

    onDestroy(() => {
        document.body.removeChild(portal);
    });
</script>

<div class="blueprint">
    <div bind:this={ref} class="overlay" class:active on:click={modalStore.hideModal}>
        {#if active}
            <slot />
        {/if}
    </div>
</div>

<style type="text/scss">
    .blueprint {
        display: none;
    }

    .overlay {
        @include z-index("overlay");
        position: absolute;
        display: flex;
        justify-content: center;
        align-items: center;
        top: 0;
        left: 0;
        @include fullHeight();
        width: 100%;
        pointer-events: none;
        transition: background-color ease-in-out 100ms, backdrop-filter ease-in-out 100ms;

        @include size-below(xs) {
            align-items: flex-end;
        }

        &.active {
            backdrop-filter: var(--modal-filter);
            pointer-events: all;
            background-color: rgba(0, 0, 0, 0.5);
        }
    }
</style>

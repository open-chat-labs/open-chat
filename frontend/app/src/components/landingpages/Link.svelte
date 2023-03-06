<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let path: string | undefined = undefined;
    export let mode: "menu" | "link" = "link";
    export let selected = false;

    const dispatch = createEventDispatcher();

    function clickLink(e: MouseEvent) {
        if (path === undefined) {
            e.preventDefault();
            dispatch("linkClicked");
        }
    }
</script>

<a
    class:menu={mode === "menu"}
    href={path === undefined ? "" : `/${path}`}
    class:selected
    on:click={clickLink}><slot /></a>

<style type="text/scss">
    .menu {
        text-decoration: none;
        @include font-size(fs-100);
        color: inherit;

        &.selected {
            color: var(--primary);
        }
    }
</style>

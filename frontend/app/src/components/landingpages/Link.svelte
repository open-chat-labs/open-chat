<script lang="ts">
    import { createEventDispatcher } from "svelte";
    // import { currentPath } from "../stores/route";

    export let path: string | undefined = undefined;
    export let mode: "menu" | "link" = "link";
    export let selected = false;

    const dispatch = createEventDispatcher();

    function clickLink(e: MouseEvent) {
        // if (path !== undefined) {
        //     currentPath.set({
        //         path,
        //         hash: "",
        //     });
        // }
        // e.preventDefault();
        dispatch("linkClicked");
    }
</script>

<a
    class="link"
    class:menu={mode === "menu"}
    href={path === undefined ? "#" : `#/${path}`}
    class:selected
    on:click={clickLink}><slot /></a>

<style type="text/scss">
    a {
        @include font(bold, normal, fs-100);
        color: inherit;

        &:hover {
            text-decoration: underline;
        }

        &.menu {
            text-decoration: none;
            font-style: normal;
        }

        &.selected {
            color: var(--primary);
        }
    }
</style>

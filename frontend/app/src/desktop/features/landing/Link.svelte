<script lang="ts">
    import { type Snippet } from "svelte";

    interface Props {
        path?: string | undefined;
        mode?: "menu" | "link";
        selected?: boolean;
        children?: Snippet;
        onLinkClicked?: () => void;
    }

    let {
        path = undefined,
        mode = "link",
        selected = false,
        children,
        onLinkClicked,
    }: Props = $props();

    function clickLink(e: MouseEvent) {
        if (path === undefined) {
            e.preventDefault();
            onLinkClicked?.();
        }
    }
</script>

<a
    class:menu={mode === "menu"}
    href={path === undefined ? "" : `/${path}`}
    class:selected
    onclick={clickLink}>{@render children?.()}</a>

<style lang="scss">
    .menu {
        text-decoration: none;
        @include font-size(fs-100);
        color: inherit;

        &.selected {
            color: var(--primary);
        }
    }
</style>

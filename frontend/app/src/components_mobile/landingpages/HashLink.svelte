<script lang="ts">
    import { locationStore } from "openchat-client";
    import type { Snippet } from "svelte";
    interface Props {
        id: string;
        children?: Snippet;
    }

    let { id, children }: Props = $props();
</script>

<a href={`${$locationStore}?section=${id}`}>{@render children?.()}</a>

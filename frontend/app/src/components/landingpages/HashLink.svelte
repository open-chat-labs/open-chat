<script lang="ts">
    import { pathState } from "openchat-client";
    import type { Snippet } from "svelte";
    interface Props {
        id: string;
        children?: Snippet;
    }

    let { id, children }: Props = $props();
</script>

<a href={`${pathState.location}?section=${id}`}>{@render children?.()}</a>

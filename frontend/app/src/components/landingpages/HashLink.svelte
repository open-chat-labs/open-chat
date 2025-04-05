<script lang="ts">
    import type { Snippet } from "svelte";
    import { location } from "../../routes";
    interface Props {
        id: string;
        children?: Snippet;
    }

    let { id, children }: Props = $props();
</script>

<a href={`${$location}?section=${id}`}>{@render children?.()}</a>

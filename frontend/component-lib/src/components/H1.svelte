<script lang="ts">
    import type { Snippet } from "svelte";
    import type { SizeMode } from "..";
    import Typography from "./Typography.svelte";

    interface Props {
        children?: Snippet;
        width?: SizeMode;
        height?: SizeMode;
    }

    let { children, ...rest }: Props = $props();
</script>

<Typography type={"h1"} {...rest}>{@render children?.()}</Typography>

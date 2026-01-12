<script lang="ts">
    import Typography, { type TypographyProps } from "./Typography.svelte";

    let props: TypographyProps = $props();
</script>

<Typography type={"h1"} {...props}>{@render props.children?.()}</Typography>

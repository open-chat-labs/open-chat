<script lang="ts">
    import Typography, { type TypographyProps } from "./Typography.svelte";

    let props: TypographyProps = $props();
</script>

<Typography type={"subtitle"} {...props}>{@render props.children?.()}</Typography>

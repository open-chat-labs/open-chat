<script lang="ts">
    import Typography, { type TypographyProps } from "./Typography.svelte";

    let props: TypographyProps = $props();
</script>

<Typography type={"chatLabel"} {...props}>{@render props.children?.()}</Typography>

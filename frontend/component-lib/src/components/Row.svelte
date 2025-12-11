<script lang="ts">
    import Container, { type ContainerProps } from "./Container.svelte";

    let props: Omit<ContainerProps, "direction"> = $props();
</script>

<Container direction={"horizontal"} {...props}>{@render props.children?.()}</Container>

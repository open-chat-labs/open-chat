<script lang="ts">
    import Container, { type ContainerProps } from "./Container.svelte";

    let props: Omit<ContainerProps, "direction"> = $props();
</script>

<Container direction={"vertical"} {...props} />

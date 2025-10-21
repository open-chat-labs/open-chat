<script lang="ts">
    import { Caption, Container } from "component-lib";
    import CheckCircle from "svelte-material-icons/CheckCircle.svelte";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";

    interface Props {
        time: number;
        edited: boolean;
    }

    let { edited, time }: Props = $props();
</script>

<Container
    supplementalClass={"message-metadata"}
    gap={"xs"}
    padding={["zero", "zero", "xs", "zero"]}
    crossAxisAlignment={"center"}
    crossAxisSelfAlignment={"end"}
    width={{ kind: "hug" }}>
    {#if edited}
        <Caption>(edited)</Caption>
    {/if}
    <Caption>
        {new Date(time).toLocaleTimeString()}
    </Caption>
    <Container supplementalClass={"message-metadata-icons"}>
        <CheckCircleOutline />
        <CheckCircle />
    </Container>
</Container>

<style lang="scss">
    :global(.message-metadata) {
        opacity: 0.6;
    }

    :global(.message-metadata-icons svg) {
        margin-inline-start: -0.35rem;
    }

    :global(.message-metadata-icons svg:first-child) {
        margin-inline-start: 0;
    }
</style>

<script module lang="ts">
    import Container from "../Container.svelte";
    import ReactionComponent from "./Reaction.svelte";

    export type Reaction = {
        text: string;
        usernames: string[];
    };
</script>

<script lang="ts">
    interface Props {
        reactions: Reaction[];
        offset: boolean;
    }

    let { reactions, offset }: Props = $props();
</script>

<Container
    supplementalClass={offset ? "reactions-offset-top" : ""}
    gap={"xxs"}
    padding={["zero", "md"]}
    width={{ kind: "hug" }}
    height={{ kind: "hug" }}
    crossAxisAlignment={"center"}>
    {#each reactions as reaction}
        <ReactionComponent {reaction} />
    {/each}
</Container>

<style lang="scss">
    :global(.reactions-offset-top) {
        top: -0.75rem;
    }
</style>

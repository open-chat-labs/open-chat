<script module lang="ts">
    import { type Alignment, Container } from "component-lib";
    import type { Reaction } from "openchat-client";
    import ReactionComponent from "./Reaction.svelte";
</script>

<script lang="ts">
    interface Props {
        me: boolean;
        reactions: Reaction[];
        offset: boolean;
        intersecting: boolean;
        onClick: (r: Reaction) => void;
    }

    let { reactions, me, offset, intersecting, onClick }: Props = $props();

    let alignTooltip = $derived<Alignment>(me ? "end" : "start");
</script>

<Container
    supplementalClass={offset ? "reactions-offset-top" : ""}
    gap={"xxs"}
    wrap
    padding={["zero", "md"]}
    width={{ kind: "hug" }}
    height={{ kind: "hug" }}
    crossAxisAlignment={"center"}>
    {#each reactions as reaction}
        <ReactionComponent {alignTooltip} {onClick} {intersecting} {reaction} />
    {/each}
</Container>

<style lang="scss">
    :global(.reactions-offset-top) {
        top: -0.5rem;
    }
</style>

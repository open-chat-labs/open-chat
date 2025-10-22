<script lang="ts">
    import { Container, type Alignment } from "component-lib";
    import { type TipsReceived } from "openchat-client";
    import Tip from "./Tip.svelte";
    interface Props {
        me: boolean;
        tips: TipsReceived;
        onClick: (ledger: string) => void;
        canTip: boolean;
        offset: boolean;
    }

    let { onClick, me, tips, offset, canTip }: Props = $props();

    let tipEntries = $derived(tips ? Object.entries(tips) : []);
    let alignTooltip = $derived<Alignment>(me ? "end" : "start");
</script>

<Container
    supplementalClass={offset ? "tips-offset-top" : ""}
    gap={"xxs"}
    wrap
    padding={["zero", "md"]}
    width={{ kind: "hug" }}
    height={{ kind: "hug" }}
    crossAxisAlignment={"center"}>
    {#each tipEntries as tip}
        <Tip {alignTooltip} {tip} {onClick} {canTip} />
    {/each}
</Container>

<style lang="scss">
    :global(.tips-offset-top) {
        top: -0.5rem;
    }
</style>

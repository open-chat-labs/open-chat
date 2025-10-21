<script lang="ts">
    import { Container } from "component-lib";
    import { type TipsReceived } from "openchat-client";
    import Tip from "./Tip.svelte";
    interface Props {
        tips: TipsReceived;
        onClick: (ledger: string) => void;
        canTip: boolean;
        offset: boolean;
    }

    let { onClick, tips, offset, canTip }: Props = $props();

    let tipEntries = $derived(tips ? Object.entries(tips) : []);
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
        <Tip {tip} {onClick} {canTip} />
    {/each}
</Container>

<style lang="scss">
    :global(.tips-offset-top) {
        top: -0.75rem;
    }
</style>

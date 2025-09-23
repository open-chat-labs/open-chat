<script lang="ts">
    import { Button, Container } from "component-lib";
    import { type CommunitySummary, sortedCommunitiesStore } from "openchat-client";

    interface Props {
        onSelect: (community: CommunitySummary) => void;
    }

    let props: Props = $props();
</script>

<Container width={{ kind: "fill" }} gap={"md"} direction={"vertical"} height={{ kind: "hug" }}>
    {#each $sortedCommunitiesStore as community}
        <Button secondary width={{ kind: "fill" }} onClick={() => props.onSelect(community)}
            >{community.name}</Button>
    {/each}
</Container>

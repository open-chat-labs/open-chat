<script lang="ts">
    import { communityJoin } from "@src/logic/join/joinFlow.svelte";
    import { communityGatesInEffect } from "@src/logic/join/previewBar";
    import { showJoinStep } from "@src/utils/join";
    import { navigate } from "@utils/navigation";
    import { Sheet } from "component-lib";
    import { selectedCommunitySummaryStore, type OpenChat } from "@client";
    import { getContext, type Snippet } from "svelte";
    import GateCheckFailed from "../access/AccessGateCheckFailed.svelte";

    type ChildProps = [boolean, () => void, () => void, boolean];

    interface Props {
        children?: Snippet<ChildProps>;
    }

    let { children }: Props = $props();

    const client = getContext<OpenChat>("client");

    async function joinCommunity() {
        const community = $selectedCommunitySummaryStore;
        if (community === undefined) return;
        showJoinStep(await communityJoin.join(client, community), "community");
    }

    // back to Explore or /welcome when the preview was opened from there, else the default scope
    function cancelPreview() {
        const community = $selectedCommunitySummaryStore;
        if (community === undefined) return;
        navigate(client.cancelPreview(community.id));
    }
</script>

{#if communityJoin.gateCheckFailed.length > 0}
    <Sheet onDismiss={() => communityJoin.reset()}>
        <GateCheckFailed onClose={() => communityJoin.reset()} />
    </Sheet>
{/if}

{@render children?.(
    communityJoin.joining !== undefined,
    joinCommunity,
    cancelPreview,
    communityGatesInEffect($selectedCommunitySummaryStore),
)}

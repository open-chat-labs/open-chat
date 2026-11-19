<!-- The Communities tab's root (/community/x): a community being previewed (not joined, or lapsed), or a
     guest's, shows its preview (CommunityPreview, N8b PR 3); a spinner while the client looks it up.
     TODO(N8a): a member's page (the switcher, channels and threads); a placeholder until then, with
     links to its channels and the other communities. -->
<script lang="ts">
    import { communitiesStore, routeForChatIdentifier, sortedCommunitiesStore } from "@client";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { previewingCommunity } from "@src/logic/join/previewBar";
    import type { NativeScreen } from "../../router/locations";
    import Placeholder from "../app/Placeholder.svelte";
    import type { ScreenProps } from "../app/screens";
    import CommunityPreview from "./CommunityPreview.svelte";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "communities" }>> =
        $props();

    const community = $derived($communitiesStore.get(screen.communityId));

    const links = $derived([
        ...(community?.channels ?? []).slice(0, 6).map((channel) => ({
            label: `#${channel.name}`,
            url: routeForChatIdentifier("community", channel.id),
        })),
        { label: "Explore", url: "/communities" },
        ...$sortedCommunitiesStore
            .filter((c) => c.id.communityId !== screen.communityId.communityId)
            .slice(0, 4)
            .map((c) => ({ label: `Switch to ${c.name}`, url: `/community/${c.id.communityId}` })),
    ]);
</script>

{#if community === undefined}
    <div class="state"><Spinner /></div>
{:else if previewingCommunity(community)}
    <CommunityPreview {community} {context} />
{:else}
    <Placeholder
        title={community.name}
        detail={`/community/${screen.communityId.communityId}`}
        root
        back={context.back}
        {links} />
{/if}

<style lang="scss">
    .state {
        display: grid;
        place-items: center;
        height: 100%;
    }
</style>

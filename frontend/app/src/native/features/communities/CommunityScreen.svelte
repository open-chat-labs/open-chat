<!-- The Communities tab's root (/community/x): a community being previewed (not joined, or lapsed), or a
     guest's, shows its preview (CommunityPreview, N8b PR 3); a member's, its page (CommunityHome, N8a: the
     header, the threads, the channels and the switcher); a spinner while the client looks it up. -->
<script lang="ts">
    import { communitiesStore } from "@client";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { previewingCommunity } from "@src/logic/join/previewBar";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import CommunityHome from "./CommunityHome.svelte";
    import CommunityPreview from "./CommunityPreview.svelte";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "communities" }>> =
        $props();

    const community = $derived($communitiesStore.get(screen.communityId));
</script>

{#if community === undefined}
    <div class="state"><Spinner /></div>
{:else if previewingCommunity(community)}
    <CommunityPreview {community} {context} />
{:else}
    <CommunityHome {community} {context} />
{/if}

<style lang="scss">
    .state {
        display: grid;
        place-items: center;
        height: 100%;
    }
</style>

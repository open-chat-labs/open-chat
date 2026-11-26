<!-- A community's members (native plan 10's Members screen; communities use the same screen),
     pushed from its details' Members row: details' Members for the community, which is the selected
     one (the page under the details), whose members the client holds. -->
<script lang="ts">
    import { communitiesStore } from "@client";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import Members from "../details/Members.svelte";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "community_members" }>> =
        $props();

    const community = $derived($communitiesStore.get(screen.communityId));
</script>

<Members target={community} {context} />

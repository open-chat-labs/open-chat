<!-- The right column's panel for a group, channel or community (GroupPanelView): which one it shows
     and which view it opens on come from the right panel's history. -->
<script lang="ts">
    import { getContext } from "svelte";
    import type { OpenChat } from "@client";
    import { closeRightColumn, openPanelOver } from "../app/rightPanel";
    import type { RightRegion, ScreenProps } from "../app/screens";
    import GroupPanelView from "./GroupPanelView.svelte";

    type GroupRegion = Extract<
        RightRegion,
        {
            kind:
                | "group_details"
                | "channel_summary"
                | "community_details"
                | "group_members"
                | "community_members"
                | "channel_or_community_members"
                | "pinned";
        }
    >;

    let { region, context }: ScreenProps<GroupRegion> = $props();

    const client = getContext<OpenChat>("client");

    // a channel's panel shows the channel or, on its community tab, the community
    const communityScope = $derived(
        region.kind === "community_details" ||
            region.kind === "community_members" ||
            ((region.kind === "channel_summary" ||
                region.kind === "channel_or_community_members") &&
                region.tab === "community"),
    );

    const viewRequest = $derived(
        region.kind === "pinned"
            ? "pinned"
            : region.kind === "community_members" && region.userGroupId !== undefined
              ? "usergroups"
              : region.kind === "group_members" ||
                  region.kind === "community_members" ||
                  region.kind === "channel_or_community_members"
                ? "members"
                : null,
    );

    function close() {
        if (region.back) {
            client.popRightPanelHistory();
        } else {
            closeRightColumn(context.rightColumn);
        }
    }
</script>

<GroupPanelView
    {communityScope}
    {viewRequest}
    dialogs={context.dialogs}
    back={region.back}
    onOpenCommunity={(v) =>
        openPanelOver(
            v === "members" ? { kind: "show_community_members" } : { kind: "community_details" },
        )}
    onClose={close}
/>

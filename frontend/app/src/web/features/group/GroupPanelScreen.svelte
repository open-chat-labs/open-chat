<!-- The right column's panel for a group or channel: GroupPanel's quick panel (GroupPanelView), as
     the design's Modal model has it. Its views, and its ⋯ menu's Manage, open Manage; pinned
     messages open in the panel. Members (?everyone, ?usergroup=) and a community's details are
     Manage's pages, so a panel asked for them opens Manage instead, and the column goes back to the
     chat's panel (a community has none). -->
<script lang="ts">
    import {
        allUsersStore,
        anonUserStore,
        blockedUsersStore,
        favouritesStore,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        type OpenChat,
    } from "@client";
    import type { ManageSection } from "@src/logic/groupOrCommunity/manage.svelte";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { closeRightColumn } from "../app/rightPanel";
    import type { RightRegion, ScreenProps } from "../app/screens";
    import { chatMenuState, runChatMenuItem } from "../conversation/chatMenu";
    import { panelMenuItems } from "../conversation/conversation.adapter";
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

    // a channel's community tab, the community's details and its members are the community's
    const communityScope = $derived(
        region.kind === "community_details" ||
            region.kind === "community_members" ||
            ((region.kind === "channel_summary" ||
                region.kind === "channel_or_community_members") &&
                region.tab === "community"),
    );

    // the Manage page a panel asks for, when it isn't the chat's own panel
    const managePage = $derived.by((): ManageSection | undefined => {
        if (region.kind === "community_members" && region.userGroupId !== undefined) {
            return "usergroups";
        }
        if (
            region.kind === "group_members" ||
            region.kind === "community_members" ||
            region.kind === "channel_or_community_members"
        ) {
            return "members";
        }
        return communityScope ? "main" : undefined;
    });

    // Opens Manage on that page and puts the column back to the chat's panel, or closes it (a
    // community has no panel). A panel asked for from a link (?everyone, ?usergroup=) or the
    // community's own entries lands here.
    $effect(() => {
        const section = managePage;
        if (section === undefined) return;
        untrack(() => {
            const target = communityScope
                ? $selectedCommunitySummaryStore?.id
                : $selectedChatSummaryStore?.kind === "group_chat" ||
                    $selectedChatSummaryStore?.kind === "channel"
                  ? $selectedChatSummaryStore.id
                  : undefined;
            if (target !== undefined) context.dialogs.open({ kind: "manage", target, section });
            if (region.back || (!communityScope && $selectedChatSummaryStore !== undefined)) {
                client.popRightPanelHistory();
            } else {
                closeRightColumn(context.rightColumn);
            }
        });
    });

    const chat = $derived(
        $selectedChatSummaryStore?.kind === "group_chat" ||
            $selectedChatSummaryStore?.kind === "channel"
            ? $selectedChatSummaryStore
            : undefined,
    );

    // the header's chat menu, without what the panel shows as buttons
    const menu = $derived(
        chat === undefined
            ? []
            : panelMenuItems(
                  chatMenuState(client, chat, {
                      favourite: $favouritesStore.has(chat.id),
                      blocked: $blockedUsersStore,
                      users: $allUsersStore,
                      community: $selectedCommunitySummaryStore,
                      anon: $anonUserStore,
                      unblockLabel: $_("unblockUser"),
                  }),
              ).map((item) => ({
                  ...item,
                  onSelect: () =>
                      runChatMenuItem(item.id, {
                          client,
                          chat,
                          title: chat.name,
                          dialogs: context.dialogs,
                          formatter: $_,
                      }),
              })),
    );

    function close() {
        if (region.back) {
            client.popRightPanelHistory();
        } else {
            closeRightColumn(context.rightColumn);
        }
    }
</script>

{#if managePage === undefined}
    <GroupPanelView
        communityScope={false}
        viewRequest={region.kind === "pinned" ? "pinned" : null}
        dialogs={context.dialogs}
        quick
        menuOverride={menu}
        back={region.back}
        onOpenCommunity={(v) =>
            $selectedCommunitySummaryStore &&
            context.dialogs.open({
                kind: "manage",
                target: $selectedCommunitySummaryStore.id,
                section: v === "members" ? "members" : "main",
            })}
        onClose={close}
    />
{/if}

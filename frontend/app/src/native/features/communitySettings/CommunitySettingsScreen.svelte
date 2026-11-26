<!-- A community's settings page (native plan 12 "Community details" → Manage, on plan 11's pages),
     pushed without a URL from its details (Manage's rows, the cover's Edit) and its page's menu
     (Invite people): Edit community, Invite and share (Invite people for the community), Access
     gates, Rules and Permissions (CommunitySettingsEditor, mounted once the community is in, and
     for Rules its rules). Channels, User groups, Bots and webhooks and Stats are still placeholders
     (GAPS.md, "Native community settings"). The community is the user's (communitiesStore) and the
     selected one, whose rules and members the pages read; its rules are held while the screen
     slides out once it isn't selected. -->
<script lang="ts">
    import {
        anonUserStore,
        communitiesStore,
        selectedCommunityIdStore,
        selectedCommunityRulesStore,
        type OpenChat,
        type VersionedRules,
    } from "@client";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { communityManageAccess } from "@src/logic/groupOrCommunity/detailsPermissions";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import Placeholder from "../app/Placeholder.svelte";
    import { HeldWhileLeaving } from "../conversation/heldWhileLeaving";
    import InvitePeople from "../details/InvitePeople.svelte";
    import CommunityInfoPage from "./CommunityInfoPage.svelte";
    import CommunitySettingsEditor from "./CommunitySettingsEditor.svelte";
    import { communityPageTitle, communitySettingsReady } from "./communitySettings.adapter";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "community_settings" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });

    const community = $derived($communitiesStore.get(screen.communityId));
    const selected = $derived(
        $selectedCommunityIdStore?.communityId === screen.communityId.communityId,
    );
    // its rules, in as it's selected (the page under the details), held as it stops being
    const heldRules = new HeldWhileLeaving<VersionedRules | undefined>(undefined);
    const rules = $derived(heldRules.of(selected, $selectedCommunityRulesStore));
    // the Rules page's draft is made from them, so it waits for them: made without, it would show
    // the default rules, and saving would put those in place of the community's
    const ready = $derived(communitySettingsReady(screen.page, community, rules));
    // a member who may not change the community sees its channels, rules and gates read only
    // (the details' Info card)
    const readOnly = $derived(
        community !== undefined &&
            communityManageAccess(client, community, $anonUserStore).kind === "about",
    );
</script>

<div class="community-settings">
    {#if readOnly && community !== undefined && (screen.page === "channels" || screen.page === "rules" || screen.page === "gates")}
        <CommunityInfoPage {community} {rules} page={screen.page} {context} />
    {:else if screen.page === "channels" || screen.page === "user_groups" || screen.page === "bots" || screen.page === "stats"}
        <!-- not built yet (GAPS.md, "Native community settings") -->
        <Placeholder
            title={communityPageTitle(screen.page, t)}
            detail="N7 left this page for later (GAPS.md)"
            root={false}
            back={context.back}
            links={[]} />
    {:else if screen.page === "invite"}
        <InvitePeople target={community} {context} />
    {:else if ready && community !== undefined}
        <CommunitySettingsEditor {community} {rules} page={screen.page} {context} />
    {:else}
        <!-- the community (for Rules, its rules too) isn't in yet: Back stays -->
        <NativePageHeader title="" onBack={context.back} />
    {/if}
</div>

<style lang="scss">
    .community-settings {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }
</style>

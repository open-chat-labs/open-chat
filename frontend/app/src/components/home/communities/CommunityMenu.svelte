<script lang="ts">
    import type { CommunitySummary, OpenChat } from "openchat-client";
    import {
        chatSummariesListStore,
        iconSize,
        mobileWidth,
        notificationsSupported,
        platformModeratorStore,
        publish,
        ROLE_NONE,
        setRightPanelHistory,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import BellOff from "svelte-material-icons/BellOff.svelte";
    import CancelIcon from "svelte-material-icons/Cancel.svelte";
    import TickIcon from "svelte-material-icons/Check.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import Contain from "svelte-material-icons/Contain.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import FileDocument from "svelte-material-icons/FileDocument.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import PlaylistPlus from "svelte-material-icons/PlaylistPlus.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
        canMarkAllRead: boolean;
    }

    let { community, canMarkAllRead }: Props = $props();

    let member = $derived(community.membership.role !== ROLE_NONE);
    let frozen = $derived(client.isCommunityFrozen(community.id));
    let canLeave = $derived(member);
    let canDelete = $derived(member && !frozen && client.canDeleteCommunity(community.id));
    let canEdit = $derived(member && !frozen && client.canEditCommunity(community.id));
    let canInvite = $derived(member && !frozen && client.canInviteUsers(community.id));
    let canCreateChannel = $derived(member && !frozen && client.canCreateChannel(community.id));
    let isCommunityMuted = $derived(
        $chatSummariesListStore.every((c) => c.membership.notificationsMuted),
    );

    function leaveCommunity() {
        publish("leaveCommunity", {
            kind: "leave_community",
            communityId: community.id,
        });
    }

    function deleteCommunity() {
        publish("deleteCommunity", {
            kind: "delete_community",
            communityId: community.id,
            doubleCheck: {
                challenge: i18nKey("typeGroupName", { name: community.name }),
                response: i18nKey(community.name),
            },
        });
    }

    function communityDetails() {
        publish("communityDetails", community);
    }

    function markAllRead() {
        client.markAllReadForCurrentScope();
    }

    function newChannel() {
        canCreateChannel && publish("newChannel", false);
    }

    function embedContent() {
        canCreateChannel && publish("newChannel", true);
    }

    function copyUrl() {
        publish("copyUrl");
    }

    function showMembers() {
        setRightPanelHistory([{ kind: "show_community_members" }]);
    }

    function invite() {
        if (canInvite) {
            setRightPanelHistory([{ kind: "invite_community_users" }]);
        }
    }

    function editCommunity() {
        canEdit && publish("editCommunity", community);
    }

    function muteAllChannels() {
        client.muteAllChannels(community.id);
    }

    function freezeCommunity() {
        client.freezeCommunity(community.id, undefined).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("failedToFreezeCommunity"));
            } else {
                toastStore.showSuccessToast(i18nKey("communityFrozen"));
            }
        });
    }

    function unfreezeCommunity() {
        client.unfreezeCommunity(community.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("failedToUnfreezeCommunity"));
            } else {
                toastStore.showSuccessToast(i18nKey("communityUnfrozen"));
            }
        });
    }
</script>

<MenuIcon position="bottom" align="end">
    {#snippet menuIcon()}
        <HoverIcon>
            <Kebab size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    {/snippet}
    {#snippet menuItems()}
        <Menu>
            <MenuItem onclick={communityDetails}>
                {#snippet icon()}
                    <FileDocument size={$iconSize} color={"var(--icon-inverted-txt)"} />
                {/snippet}
                {#snippet text()}
                    <div><Translatable resourceKey={i18nKey("communities.details")} /></div>
                {/snippet}
            </MenuItem>
            <MenuItem onclick={showMembers}>
                {#snippet icon()}
                    <AccountMultiple size={$iconSize} color={"var(--icon-inverted-txt)"} />
                {/snippet}
                {#snippet text()}
                    <div><Translatable resourceKey={i18nKey("communities.members")} /></div>
                {/snippet}
            </MenuItem>
            {#if canInvite}
                <MenuItem onclick={invite}>
                    {#snippet icon()}
                        <AccountMultiplePlus size={$iconSize} color={"var(--icon-inverted-txt)"} />
                    {/snippet}
                    {#snippet text()}
                        <div>
                            <Translatable resourceKey={i18nKey("communities.invite")} />
                        </div>
                    {/snippet}
                </MenuItem>
            {/if}
            {#if canEdit}
                <MenuItem onclick={editCommunity}>
                    {#snippet icon()}
                        <PencilOutline size={$iconSize} color={"var(--icon-inverted-txt)"} />
                    {/snippet}
                    {#snippet text()}
                        <div>
                            <Translatable resourceKey={i18nKey("communities.edit")} />
                        </div>
                    {/snippet}
                </MenuItem>
            {/if}
            {#if canCreateChannel}
                <MenuItem onclick={newChannel}>
                    {#snippet icon()}
                        <PlaylistPlus size={$iconSize} color={"var(--icon-inverted-txt)"} />
                    {/snippet}
                    {#snippet text()}
                        <span
                            ><Translatable
                                resourceKey={i18nKey("communities.createChannel")} /></span>
                    {/snippet}
                </MenuItem>
            {/if}
            {#if canCreateChannel}
                <MenuItem onclick={embedContent}>
                    {#snippet icon()}
                        <Contain size={$iconSize} color={"var(--icon-inverted-txt)"} />
                    {/snippet}
                    {#snippet text()}
                        <span><Translatable resourceKey={i18nKey("communities.embed")} /></span>
                    {/snippet}
                </MenuItem>
            {/if}
            {#if $mobileWidth}
                <MenuItem onclick={copyUrl}>
                    {#snippet icon()}
                        <ContentCopy size={$iconSize} color={"var(--icon-txt)"} />
                    {/snippet}
                    {#snippet text()}
                        <Translatable resourceKey={i18nKey("copyUrl")} />
                    {/snippet}
                </MenuItem>
            {/if}
            <MenuItem disabled={!canMarkAllRead} onclick={markAllRead}>
                {#snippet icon()}
                    <CheckboxMultipleMarked size={$iconSize} color={"var(--icon-inverted-txt)"} />
                {/snippet}
                {#snippet text()}
                    <span><Translatable resourceKey={i18nKey("markAllRead")} /></span>
                {/snippet}
            </MenuItem>
            {#if notificationsSupported && !isCommunityMuted}
                <MenuItem onclick={muteAllChannels}>
                    {#snippet icon()}
                        <BellOff size={$iconSize} color={"var(--icon-inverted-txt)"} />
                    {/snippet}
                    {#snippet text()}
                        <span
                            ><Translatable
                                resourceKey={i18nKey("communities.muteAllChannels")} /></span>
                    {/snippet}
                </MenuItem>
            {/if}
            {#if member}
                <MenuItem separator />
                {#if canDelete}
                    <MenuItem warning onclick={deleteCommunity}>
                        {#snippet icon()}
                            <DeleteOutline size={$iconSize} color={"var(--menu-warn)"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("communities.delete")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if canLeave}
                    <MenuItem warning onclick={leaveCommunity}>
                        {#snippet icon()}
                            <LocationExit size={$iconSize} color={"var(--menu-warn)"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("communities.leave")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
            {/if}
            {#if $platformModeratorStore}
                {#if client.isCommunityFrozen(community.id)}
                    <MenuItem warning onclick={unfreezeCommunity}>
                        {#snippet icon()}
                            <TickIcon size={$iconSize} color={"var(--menu-warn"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("unfreezeCommunity")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {:else}
                    <MenuItem warning onclick={freezeCommunity}>
                        {#snippet icon()}
                            <CancelIcon size={$iconSize} color={"var(--menu-warn"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("freezeCommunity")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
            {/if}
        </Menu>
    {/snippet}
</MenuIcon>

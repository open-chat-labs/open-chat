<script lang="ts">
    import { MenuItem } from "component-lib";
    import type { CommunitySummary, OpenChat } from "openchat-client";
    import {
        chatSummariesListStore,
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
    import FileDocument from "svelte-material-icons/FileDocument.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import PlaylistPlus from "svelte-material-icons/PlaylistPlus.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
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
    let isAtEveryoneMutedForCommunity = $derived(
        $chatSummariesListStore.every((c) => c.membership.atEveryoneMuted),
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

    function muteAllChannels(muteAtEveryone: boolean) {
        client.muteAllChannels(community.id, muteAtEveryone);
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

<MenuItem onclick={communityDetails}>
    {#snippet icon(color, size)}
        <FileDocument {color} {size} />
    {/snippet}
    <Translatable resourceKey={i18nKey("communities.details")} />
</MenuItem>
<MenuItem onclick={showMembers}>
    {#snippet icon(color, size)}
        <AccountMultiple {color} {size} />
    {/snippet}
    <Translatable resourceKey={i18nKey("communities.members")} />
</MenuItem>
{#if canInvite}
    <MenuItem onclick={invite}>
        {#snippet icon(color, size)}
            <AccountMultiplePlus {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("communities.invite")} />
    </MenuItem>
{/if}
{#if canEdit}
    <MenuItem onclick={editCommunity}>
        {#snippet icon(color, size)}
            <PencilOutline {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("communities.edit")} />
    </MenuItem>
{/if}
{#if canCreateChannel}
    <MenuItem onclick={newChannel}>
        {#snippet icon(color, size)}
            <PlaylistPlus {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("communities.createChannel")} />
    </MenuItem>
{/if}
{#if canCreateChannel}
    <MenuItem onclick={embedContent}>
        {#snippet icon(color, size)}
            <Contain {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("communities.embed")} />
    </MenuItem>
{/if}
{#if $mobileWidth}
    <MenuItem onclick={copyUrl}>
        {#snippet icon(color, size)}
            <ContentCopy {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("copyUrl")} />
    </MenuItem>
{/if}
<MenuItem disabled={!canMarkAllRead} onclick={markAllRead}>
    {#snippet icon(color, size)}
        <CheckboxMultipleMarked {color} {size} />
    {/snippet}
    <Translatable resourceKey={i18nKey("markAllRead")} />
</MenuItem>
{#if notificationsSupported}
    {#if !isCommunityMuted}
        <MenuItem onclick={() => muteAllChannels(false)}>
            {#snippet icon(color, size)}
                <BellOff {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("communities.muteAllChannels")} />
        </MenuItem>
    {/if}
    {#if !isAtEveryoneMutedForCommunity}
        <MenuItem onclick={() => muteAllChannels(true)}>
            {#snippet icon(color, size)}
                <BellOff {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("communities.muteAllChannelsAtEveryone")} />
        </MenuItem>
    {/if}
{/if}
{#if member}
    <MenuItem separator />
    {#if canDelete}
        <MenuItem danger onclick={deleteCommunity}>
            {#snippet icon(color, size)}
                <DeleteOutline {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("communities.delete")} />
        </MenuItem>
    {/if}
    {#if canLeave}
        <MenuItem danger onclick={leaveCommunity}>
            {#snippet icon(color, size)}
                <LocationExit {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("communities.leave")} />
        </MenuItem>
    {/if}
{/if}
{#if $platformModeratorStore}
    {#if client.isCommunityFrozen(community.id)}
        <MenuItem danger onclick={unfreezeCommunity}>
            {#snippet icon(color, size)}
                <TickIcon {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("unfreezeCommunity")} />
        </MenuItem>
    {:else}
        <MenuItem danger onclick={freezeCommunity}>
            {#snippet icon(color, size)}
                <CancelIcon {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("freezeCommunity")} />
        </MenuItem>
    {/if}
{/if}

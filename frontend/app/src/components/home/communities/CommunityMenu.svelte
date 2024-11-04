<script lang="ts">
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import BellOff from "svelte-material-icons/BellOff.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import Contain from "svelte-material-icons/Contain.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import FileDocument from "svelte-material-icons/FileDocument.svelte";
    import PlaylistPlus from "svelte-material-icons/PlaylistPlus.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import type { CommunitySummary, OpenChat } from "openchat-client";
    import { chatSummariesListStore } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import { rightPanelHistory } from "../../../stores/rightPanel";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { notificationsSupported } from "../../../utils/notifications";

    const client = getContext<OpenChat>("client");

    export let community: CommunitySummary;
    export let canMarkAllRead: boolean;

    const dispatch = createEventDispatcher();

    $: member = community.membership.role !== "none";
    $: canLeave = member;
    $: canDelete = member && client.canDeleteCommunity(community.id);
    $: canEdit = member && client.canEditCommunity(community.id);
    $: canInvite = member && client.canInviteUsers(community.id);
    $: canCreateChannel = member && client.canCreateChannel(community.id);
    $: isCommunityMuted = $chatSummariesListStore.every((c) => c.membership.notificationsMuted);

    function leaveCommunity() {
        dispatch("leaveCommunity", {
            kind: "leave_community",
            communityId: community.id,
        });
    }

    function deleteCommunity() {
        dispatch("deleteCommunity", {
            kind: "delete_community",
            communityId: community.id,
            doubleCheck: {
                challenge: i18nKey("typeGroupName", { name: community.name }),
                response: i18nKey(community.name),
            },
        });
    }

    function communityDetails() {
        dispatch("communityDetails", community);
    }

    function markAllRead() {
        dispatch("markAllRead");
    }

    function newChannel() {
        canCreateChannel && dispatch("newChannel", false);
    }

    function embedContent() {
        canCreateChannel && dispatch("newChannel", true);
    }

    function showMembers() {
        rightPanelHistory.set([{ kind: "show_community_members" }]);
    }

    function invite() {
        canInvite && rightPanelHistory.set([{ kind: "invite_community_users" }]);
    }

    function editCommunity() {
        canEdit && dispatch("editCommunity", community);
    }

    function muteAllChannels() {
        client.muteAllChannels(community.id);
    }
</script>

<MenuIcon position="bottom" align="end">
    <span slot="icon">
        <HoverIcon>
            <Kebab size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
    <span slot="menu">
        <Menu>
            <MenuItem on:click={communityDetails}>
                <FileDocument size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <div slot="text"><Translatable resourceKey={i18nKey("communities.details")} /></div>
            </MenuItem>
            <MenuItem on:click={showMembers}>
                <AccountMultiple size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <div slot="text"><Translatable resourceKey={i18nKey("communities.members")} /></div>
            </MenuItem>
            {#if canInvite}
                <MenuItem on:click={invite}>
                    <AccountMultiplePlus
                        size={$iconSize}
                        color={"var(--icon-inverted-txt)"}
                        slot="icon" />
                    <div slot="text">
                        <Translatable resourceKey={i18nKey("communities.invite")} />
                    </div>
                </MenuItem>
            {/if}
            {#if canEdit}
                <MenuItem on:click={editCommunity}>
                    <PencilOutline
                        size={$iconSize}
                        color={"var(--icon-inverted-txt)"}
                        slot="icon" />
                    <div slot="text">
                        <Translatable resourceKey={i18nKey("communities.edit")} />
                    </div>
                </MenuItem>
            {/if}
            {#if canCreateChannel}
                <MenuItem on:click={newChannel}>
                    <PlaylistPlus size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                    <span slot="text"
                        ><Translatable resourceKey={i18nKey("communities.createChannel")} /></span>
                </MenuItem>
            {/if}
            {#if canCreateChannel}
                <MenuItem on:click={embedContent}>
                    <Contain size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                    <span slot="text"
                        ><Translatable resourceKey={i18nKey("communities.embed")} /></span>
                </MenuItem>
            {/if}
            <MenuItem disabled={!canMarkAllRead} on:click={markAllRead}>
                <CheckboxMultipleMarked
                    size={$iconSize}
                    color={"var(--icon-inverted-txt)"}
                    slot="icon" />
                <span slot="text"><Translatable resourceKey={i18nKey("markAllRead")} /></span>
            </MenuItem>
            {#if notificationsSupported && !isCommunityMuted}
                <MenuItem on:click={muteAllChannels}>
                    <BellOff size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                    <span slot="text"
                        ><Translatable
                            resourceKey={i18nKey("communities.muteAllChannels")} /></span>
                </MenuItem>
            {/if}
            {#if member}
                <MenuItem separator />
                {#if canDelete}
                    <MenuItem warning on:click={deleteCommunity}>
                        <DeleteOutline size={$iconSize} color={"var(--menu-warn)"} slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("communities.delete")} />
                        </div>
                    </MenuItem>
                {/if}
                {#if canLeave}
                    <MenuItem warning on:click={leaveCommunity}>
                        <LocationExit size={$iconSize} color={"var(--menu-warn)"} slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("communities.leave")} />
                        </div>
                    </MenuItem>
                {/if}
            {/if}
        </Menu>
    </span>
</MenuIcon>

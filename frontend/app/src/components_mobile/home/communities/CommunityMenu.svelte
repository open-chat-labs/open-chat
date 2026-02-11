<script lang="ts">
    import { MenuItem } from "component-lib";
    import type { CommunitySummary, OpenChat } from "openchat-client";
    import {
        chatSummariesListStore,
        notificationsSupported,
        platformModeratorStore,
        publish,
        ROLE_NONE,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Translatable from "../../Translatable.svelte";
    import { updateGroupState } from "../createOrUpdateGroup/group.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
        canMarkAllRead: boolean;
        onOtherChannels?: () => void;
    }

    let { community, canMarkAllRead, onOtherChannels }: Props = $props();

    let member = $derived(community.membership.role !== ROLE_NONE);
    let frozen = $derived(client.isCommunityFrozen(community.id));
    let canLeave = $derived(member);
    let canDelete = $derived(member && !frozen && client.canDeleteCommunity(community.id));
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
        if (canCreateChannel) {
            updateGroupState.initialise(client.createCandidateGroup("channel", false));
            publish("newChannel", false);
        }
    }

    function embedContent() {
        if (canCreateChannel) {
            updateGroupState.initialise(client.createCandidateGroup("channel", true));
            publish("newChannel", true);
        }
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
    <Translatable resourceKey={i18nKey("communities.details")} />
</MenuItem>
{#if canCreateChannel}
    <MenuItem onclick={newChannel}>
        <Translatable resourceKey={i18nKey("communities.createChannel")} />
    </MenuItem>
{/if}
{#if canCreateChannel}
    <MenuItem onclick={embedContent}>
        <Translatable resourceKey={i18nKey("communities.embed")} />
    </MenuItem>
{/if}
<MenuItem disabled={!canMarkAllRead} onclick={markAllRead}>
    <Translatable resourceKey={i18nKey("markAllRead")} />
</MenuItem>
{#if notificationsSupported}
    {#if !isCommunityMuted}
        <MenuItem onclick={() => muteAllChannels(false)}>
            <Translatable resourceKey={i18nKey("communities.muteAllChannels")} />
        </MenuItem>
    {/if}
    {#if !isAtEveryoneMutedForCommunity}
        <MenuItem onclick={() => muteAllChannels(true)}>
            <Translatable resourceKey={i18nKey("communities.muteAllChannelsAtEveryone")} />
        </MenuItem>
    {/if}
{/if}
<MenuItem onclick={onOtherChannels}>
    <Translatable resourceKey={i18nKey("communities.otherChannels")} />
</MenuItem>
{#if member}
    <MenuItem separator />
    {#if canDelete}
        <MenuItem danger onclick={deleteCommunity}>
            <Translatable resourceKey={i18nKey("communities.delete")} />
        </MenuItem>
    {/if}
    {#if canLeave}
        <MenuItem danger onclick={leaveCommunity}>
            <Translatable resourceKey={i18nKey("communities.leave")} />
        </MenuItem>
    {/if}
{/if}
{#if $platformModeratorStore}
    {#if client.isCommunityFrozen(community.id)}
        <MenuItem danger onclick={unfreezeCommunity}>
            <Translatable resourceKey={i18nKey("unfreezeCommunity")} />
        </MenuItem>
    {:else}
        <MenuItem danger onclick={freezeCommunity}>
            <Translatable resourceKey={i18nKey("freezeCommunity")} />
        </MenuItem>
    {/if}
{/if}

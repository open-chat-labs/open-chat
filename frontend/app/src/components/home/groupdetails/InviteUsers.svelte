<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import Loading from "../../Loading.svelte";
    import Button from "../../Button.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import SelectUsers from "../SelectUsers.svelte";
    import type {
    ChannelIdentifier,
        CommunitySummary,
        Level,
        MultiUserChat,
        OpenChat,
        UserSummary,
    } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import InviteUsersWithLink from "../InviteUsersWithLink.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { toastStore } from "../../../stores/toast";
    import { popRightPanelHistory } from "../../../stores/rightPanel";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let closeIcon: "close" | "back";
    export let busy = false;
    export let userLookup: (searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>;
    export let memberLookup: ((searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>) | undefined = undefined;
    export let level: Level;
    export let container: MultiUserChat | CommunitySummary;
    export let isCommunityPublic: boolean;

    type Tab = "invite_users" | "add_members" | "share";

    $: canInvite = client.canInviteUsers(container.id);
    $: canAdd = !isCommunityPublic && container.kind === "channel" && client.canAddMembers(container.id);

    let usersToAddOrInvite: UserSummary[] = [];
    let selectedTab: Tab = "share";

    onMount(() => {
        selectedTab = canAdd ? "add_members" : canInvite ? "invite_users" : "share";
    });

    function cancelInviteUsers() {
        dispatch("cancelInviteUsers");
    }

    function inviteUsers() {
        dispatch("inviteUsers", usersToAddOrInvite);
    }

    async function addMembers() {
        busy = true;

        const userIds = usersToAddOrInvite.map((u) => u.userId);

        await client
            .addMembersToChannel(container.id as ChannelIdentifier, userIds)
            .then((resp) => {
                switch (resp.kind) {
                    case "success": {
                        popRightPanelHistory();
                        break;
                    }
                    case "add_to_channel_partial_success": {
                        popRightPanelHistory();
                        toastStore.showSuccessToast(i18nKey("group.addMembersPartialSuccess"));
                        break;
                    }
                    default: {
                        toastStore.showFailureToast(i18nKey("group.addMembersFailed"));
                        break;
                    }
                }
            })
            .catch(() => {
                toastStore.showFailureToast(
                    i18nKey("group.addMembersFailed"),
                );
            });

        busy = false;
    }

    function deleteUser(ev: CustomEvent<UserSummary>) {
        usersToAddOrInvite = usersToAddOrInvite.filter((u) => u.userId !== ev.detail.userId);
    }

    function selectUser(ev: CustomEvent<UserSummary>) {
        if (!usersToAddOrInvite.find((u) => u.userId === ev.detail.userId)) {
            usersToAddOrInvite = [...usersToAddOrInvite, ev.detail];
        }
    }

    function selectTab(tab: Tab) {
        selectedTab = tab;
        usersToAddOrInvite = [];
    }
</script>

<SectionHeader border={false} flush>
    <h4><Translatable resourceKey={canAdd ? i18nKey("group.addOrInviteUsers") : i18nKey("group.inviteUsers", undefined, level, true)} /></h4>
    <span title={$_("close")} class="close" on:click={cancelInviteUsers}>
        <HoverIcon>
            {#if closeIcon === "close"}
                <Close size={$iconSize} color={"var(--icon-txt)"} />
            {:else}
                <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </HoverIcon>
    </span>
</SectionHeader>

{#if canInvite || canAdd}
    <div class="tabs">
        {#if canAdd}
            <div
                tabindex="0"
                role="button"
                on:click={() => selectTab("add_members")}
                class:selected={selectedTab === "add_members"}
                class="tab">
                <Translatable resourceKey={i18nKey("group.addMembersTab")} />
            </div>
        {/if}
        {#if canInvite}
            <div
                tabindex="0"
                role="button"
                on:click={() => selectTab("invite_users")}
                class:selected={selectedTab === "invite_users"}
                class="tab">
                <Translatable resourceKey={i18nKey("group.inviteUsersTab")} />
            </div>
        {/if}
        <div
            tabindex="0"
            role="button"
            on:click={() => selectTab("share")}
            class:selected={selectedTab === "share"}
            class="tab">
            <Translatable resourceKey={i18nKey("group.shareTab")} />
        </div>
    </div>
{/if}

{#if !busy}
    <div class="find-user">
        <div>
            {#if selectedTab === "invite_users"}
                <div class="subheading"><Translatable resourceKey={i18nKey("group.searchForUser")} /></div>
                <SelectUsers
                    {userLookup}
                    mode={"edit"}
                    on:selectUser={selectUser}
                    on:deleteUser={deleteUser}
                    selectedUsers={usersToAddOrInvite} />
            {:else if selectedTab === "add_members" && memberLookup !== undefined}
                <div class="subheading"><Translatable resourceKey={i18nKey("group.searchForCommunityMember")} /></div>
                <SelectUsers
                    userLookup={memberLookup}
                    mode={"edit"}
                    on:selectUser={selectUser}
                    on:deleteUser={deleteUser}
                    selectedUsers={usersToAddOrInvite} />
            {:else}
                <div class="subheading"><Translatable resourceKey={i18nKey("invite.inviteWithLink", undefined, container.level, true)} /></div>
                <InviteUsersWithLink {container} />
            {/if}
        </div>
    </div>
{/if}

{#if selectedTab !== "share"}
    {#if busy}
        <Loading />
    {/if}

    <div class="cta">
        <Button
            disabled={busy || usersToAddOrInvite.length === 0}
            loading={busy}
            square
            on:click={selectedTab === "invite_users" ? inviteUsers : addMembers}
            fill
            ><Translatable
                resourceKey={selectedTab === "invite_users" ? i18nKey("group.inviteUsers", undefined, level, true) : i18nKey("group.addMembers")} /></Button>
    </div>
{/if}

<style lang="scss">
    :global(.find-user .find-user .search-form) {
        margin: 0 0 $sp4 0;
        @include mobile() {
            margin: 0 0 $sp3 0;
        }
    }

    h4 {
        flex: 1;
        padding: 0 $sp4;
        @include font-size(fs-120);
    }
    .close {
        flex: 0 0 30px;
    }
    .find-user {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 0 $sp4;

        @include mobile() {
            padding: 0 $sp3;
        }
    }
    .cta {
        flex: 0 0 toRem(60);
    }

    .subheading {
        margin-bottom: $sp4;
    }

    .tabs {
        display: flex;
        align-items: center;
        @include font(medium, normal, fs-90);
        color: var(--txt-light);
        gap: $sp5;
        border-bottom: 1px solid var(--bd);
        cursor: pointer;
        margin: 0 $sp4 $sp5 $sp4;

        @include mobile() {
            gap: $sp4;
        }

        .tab {
            padding-bottom: 10px;
            margin-bottom: -2px;
            border-bottom: 3px solid transparent;
            white-space: nowrap;
            &.selected {
                color: var(--txt);
                border-bottom: 3px solid var(--txt);
            }
        }
    }
</style>

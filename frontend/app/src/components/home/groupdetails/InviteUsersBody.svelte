<script lang="ts">
    import Loading from "../../Loading.svelte";
    import Button from "../../Button.svelte";
    import { _ } from "svelte-i18n";
    import SelectUsers from "../SelectUsers.svelte";
    import type {
        ChannelIdentifier,
        CommunitySummary,
        Level,
        MultiUserChat,
        OpenChat,
        UserOrUserGroup,
        UserSummary,
    } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import InviteUsersWithLink from "../InviteUsersWithLink.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { toastStore } from "../../../stores/toast";
    import { popRightPanelHistory } from "../../../stores/rightPanel";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let busy = false;
    export let userLookup: (searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>;
    export let memberLookup:
        | ((searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>)
        | undefined = undefined;
    export let level: Level;
    export let container: MultiUserChat | CommunitySummary;
    export let isCommunityPublic: boolean;

    type Tab = "invite_users" | "add_members" | "share";

    $: canInvite = client.canInviteUsers(container.id);
    $: canAdd =
        !isCommunityPublic && container.kind === "channel" && client.canAddMembers(container.id);

    let usersToAddOrInvite: UserSummary[] = [];
    let selectedTab: Tab = "share";

    onMount(() => {
        selectedTab = canAdd ? "add_members" : canInvite ? "invite_users" : "share";
    });

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
                toastStore.showFailureToast(i18nKey("group.addMembersFailed"));
            });

        busy = false;
    }

    function deleteUser(user: UserOrUserGroup) {
        if (user.kind === "user") {
            usersToAddOrInvite = usersToAddOrInvite.filter((u) => u.userId !== user.userId);
        }
    }

    function selectUser(user: UserSummary) {
        if (!usersToAddOrInvite.find((u) => u.userId === user.userId)) {
            usersToAddOrInvite = [...usersToAddOrInvite, user];
        }
    }

    function selectTab(tab: Tab) {
        selectedTab = tab;
        usersToAddOrInvite = [];
    }
</script>

{#if canInvite || canAdd}
    <div class="tabs">
        {#if canAdd}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
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
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div
                tabindex="0"
                role="button"
                on:click={() => selectTab("invite_users")}
                class:selected={selectedTab === "invite_users"}
                class="tab">
                <Translatable resourceKey={i18nKey("group.inviteUsersTab")} />
            </div>
        {/if}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
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
                <div class="subheading">
                    <Translatable resourceKey={i18nKey("group.searchForUser")} />
                </div>
                <SelectUsers
                    {userLookup}
                    mode={"edit"}
                    onSelectUser={selectUser}
                    onDeleteUser={deleteUser}
                    selectedUsers={usersToAddOrInvite} />
            {:else if selectedTab === "add_members" && memberLookup !== undefined}
                <div class="subheading">
                    <Translatable resourceKey={i18nKey("group.searchForCommunityMember")} />
                </div>
                <SelectUsers
                    userLookup={memberLookup}
                    mode={"edit"}
                    onSelectUser={selectUser}
                    onDeleteUser={deleteUser}
                    selectedUsers={usersToAddOrInvite} />
            {:else}
                <div class="subheading">
                    <Translatable
                        resourceKey={i18nKey(
                            "invite.inviteWithLink",
                            undefined,
                            container.level,
                            true,
                        )} />
                </div>
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
            onClick={selectedTab === "invite_users" ? inviteUsers : addMembers}
            fill
            ><Translatable
                resourceKey={selectedTab === "invite_users"
                    ? i18nKey("group.inviteUsers", undefined, level, true)
                    : i18nKey("group.addMembers")} /></Button>
    </div>
{/if}

<style lang="scss">
    :global(.find-user .find-user .search-form) {
        margin: 0 0 $sp4 0;
        @include mobile() {
            margin: 0 0 $sp3 0;
        }
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

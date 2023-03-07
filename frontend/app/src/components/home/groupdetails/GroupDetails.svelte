<script lang="ts">
    import GroupDetailsHeader from "./GroupDetailsHeader.svelte";
    import Avatar from "../../Avatar.svelte";
    import Stats from "../Stats.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import GroupPermissionsViewer from "../GroupPermissionsViewer.svelte";
    import Legend from "../../Legend.svelte";
    import ViewUserProfile from "../profile/ViewUserProfile.svelte";
    import Markdown from "../Markdown.svelte";
    import {
        groupAdvancedOpen,
        groupInfoOpen,
        groupInviteUsersOpen,
        groupPermissionsOpen,
        groupRulesOpen,
        groupStatsOpen,
        groupVisibilityOpen,
    } from "../../../stores/settings";
    import AdvancedSection from "./AdvancedSection.svelte";
    import InviteUsers from "./InviteUsers.svelte";
    import type { OpenChat, GroupChatSummary, GroupRules } from "openchat-client";
    import { AvatarSize } from "openchat-client";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");
    const currentUser = client.user;

    export let chat: GroupChatSummary;
    export let memberCount: number;
    export let rules: GroupRules | undefined;

    $: userStore = client.userStore;

    let viewProfile = false;

    // capture a snapshot of the chat as it is right now
    $: myGroup = currentUser.userId === chat.ownerId;
    $: canEdit = client.canEditGroupDetails(chat.chatId);
    $: canInvite = client.canInviteUsers(chat.chatId);
    $: avatarSrc = client.groupAvatarUrl(chat);

    function openUserProfile() {
        if (!myGroup) {
            viewProfile = true;
        }
    }

    function editGroup() {
        if (canEdit) {
            dispatch("editGroup", { chat, rules });
        }
    }

    function closeUserProfile() {
        viewProfile = false;
    }

    function clickClose() {
        dispatch("close");
    }

    function showMembers() {
        dispatch("showMembers");
    }

    function chatWithOwner() {
        if (!myGroup) {
            closeUserProfile();
            dispatch("chatWith", chat.ownerId);
            dispatch("close");
        }
    }

    function description(chat: GroupChatSummary): string {
        let description = chat.description;

        if (chat.subtype?.kind === "governance_proposals" ?? false) {
            description = description.replace("{userId}", currentUser.userId);
        }

        return description;
    }
</script>

{#if viewProfile}
    <ViewUserProfile
        userId={chat.ownerId}
        on:openDirectChat={chatWithOwner}
        on:close={closeUserProfile} />
{/if}

<GroupDetailsHeader
    {canEdit}
    on:showMembers={showMembers}
    on:close={clickClose}
    on:editGroup={editGroup} />

<div class="group-details">
    <div class="inner">
        <CollapsibleCard
            on:toggle={groupInfoOpen.toggle}
            open={$groupInfoOpen}
            headerText={$_("group.groupInfo")}>
            <div class="sub-section photo">
                <Avatar url={avatarSrc} size={AvatarSize.Large} />

                <h3 class="group-name">{chat.name}</h3>
                <p class="members">
                    {$_("memberCount", { values: { count: memberCount } })}
                </p>
                <p class="owned-by" on:click={openUserProfile} class:my-group={myGroup}>
                    {$_("ownedBy", {
                        values: {
                            username: $userStore[chat.ownerId]?.username ?? "unknown",
                        },
                    })}
                </p>
            </div>

            {#if chat.description?.length > 0}
                <fieldset>
                    <legend>
                        <Legend label={$_("groupDesc")} />
                    </legend>
                    <Markdown text={description(chat)} />
                </fieldset>
            {/if}
        </CollapsibleCard>
        <CollapsibleCard
            on:toggle={groupVisibilityOpen.toggle}
            open={$groupVisibilityOpen}
            headerText={$_("group.visibility")}>
            {#if chat.public}
                <h4>{$_("group.publicGroup")}</h4>
            {:else}
                <h4>{$_("group.privateGroup")}</h4>
            {/if}
            <div class="info">
                {#if chat.public}
                    <p>{$_("publicGroupInfo")}</p>
                {:else}
                    <p>{$_("group.privateGroupInfo")}</p>
                {/if}
                {#if !chat.public}
                    {#if chat.historyVisibleToNewJoiners}
                        <p>{$_("historyOnInfo")}</p>
                    {:else}
                        <p>{$_("historyOffInfo")}</p>
                    {/if}
                {/if}
            </div>
        </CollapsibleCard>
        {#if rules !== undefined && rules.enabled}
            <CollapsibleCard
                on:toggle={groupRulesOpen.toggle}
                open={$groupRulesOpen}
                headerText={$_("group.groupRules")}>
                <Markdown inline={false} text={rules.text} />
            </CollapsibleCard>
        {/if}
        {#if canInvite}
            <CollapsibleCard
                on:toggle={groupInviteUsersOpen.toggle}
                open={$groupInviteUsersOpen}
                headerText={$_("group.invite.inviteWithLink")}>
                <InviteUsers group={chat} />
            </CollapsibleCard>
        {/if}
        <CollapsibleCard
            on:toggle={groupPermissionsOpen.toggle}
            open={$groupPermissionsOpen}
            headerText={$_("group.permissions.permissions")}>
            <GroupPermissionsViewer bind:permissions={chat.permissions} isPublic={chat.public} />
        </CollapsibleCard>
        <CollapsibleCard
            on:toggle={groupStatsOpen.toggle}
            open={$groupStatsOpen}
            headerText={$_("stats.groupStats")}>
            <Stats showReported={false} stats={chat.metrics} />
        </CollapsibleCard>
        {#if client.canDeleteGroup(chat.chatId)}
            <CollapsibleCard
                on:toggle={groupAdvancedOpen.toggle}
                open={$groupAdvancedOpen}
                headerText={$_("group.advanced")}>
                <AdvancedSection on:deleteGroup group={chat} />
            </CollapsibleCard>
        {/if}
    </div>
</div>

<style type="text/scss">
    .photo {
        text-align: center;
    }

    fieldset {
        border: 1px solid var(--bd);
        border-radius: $sp2;
        padding: $sp3;
        @include font(light, normal, fs-100);
    }

    .group-details {
        flex: 1;
        overflow: auto;
        overflow-x: hidden;
        @include nice-scrollbar();
        background-color: transparent;
    }

    .inner {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        padding: $sp3 $sp5 0 $sp5;

        @include mobile() {
            padding: $sp3 $sp4 0 $sp4;
        }
    }

    h4,
    h3 {
        margin-bottom: $sp3;
    }

    h3 {
        @include font(bold, normal, fs-120);
    }

    .group-name {
        margin-top: $sp4;
    }

    .members {
        @include font(light, normal, fs-90);
    }

    .owned-by {
        @include font(book, normal, fs-90);
        cursor: pointer;

        &.my-group {
            cursor: auto;
        }
    }

    .sub-section {
        padding: $sp4;
        // background-color: var(--sub-section-bg);
        margin-bottom: $sp3;
        // border: 1px solid var(--bd);
        border-radius: $sp2;
    }

    .info {
        @include font(light, normal, fs-90);

        p {
            margin-bottom: $sp4;
            &:last-child {
                margin-bottom: 0;
            }
        }
    }
</style>

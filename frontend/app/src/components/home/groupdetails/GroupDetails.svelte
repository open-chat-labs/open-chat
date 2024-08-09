<script lang="ts">
    import GroupDetailsHeader from "./GroupDetailsHeader.svelte";
    import Avatar from "../../Avatar.svelte";
    import Stats from "../Stats.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import GroupPermissionsViewer from "../GroupPermissionsViewer.svelte";
    import Legend from "../../Legend.svelte";
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
    import InviteUsersWithLink from "../InviteUsersWithLink.svelte";
    import type { OpenChat, MultiUserChat } from "openchat-client";
    import { AvatarSize } from "openchat-client";
    import AccessGateSummary from "../access/AccessGateSummary.svelte";
    import DisappearingMessagesSummary from "../DisappearingMessagesSummary.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    export let chat: MultiUserChat;
    export let memberCount: number;

    // capture a snapshot of the chat as it is right now
    $: currentUser = client.user;
    $: canEdit = client.canEditGroupDetails(chat.id);
    $: canSend = client.canSendMessage(chat.id, "any");
    $: canInvite =
        client.canInviteUsers(chat.id) && (chat.kind !== "channel" || !client.isChatPrivate(chat));
    $: avatarSrc = client.groupAvatarUrl(chat);

    $: currentChatRules = client.currentChatRules;
    $: currentCommunityRules = client.currentCommunityRules;
    $: combinedRulesText = canSend
        ? client.combineRulesText($currentChatRules, $currentCommunityRules)
        : "";
    $: embeddedContent = chat.kind === "channel" && chat.externalUrl !== undefined;

    function editGroup() {
        if (canEdit) {
            dispatch("editGroup", { chat, rules: { ...$currentChatRules, newVersion: false } });
        }
    }

    function clickClose() {
        dispatch("close");
    }

    function showGroupMembers() {
        dispatch("showGroupMembers");
    }

    function description(chat: MultiUserChat): string {
        let description = chat.description;

        if (chat.subtype?.kind === "governance_proposals" ?? false) {
            description = description.replace("{userId}", $currentUser.userId);
        }

        return description;
    }
</script>

<GroupDetailsHeader
    level={chat.level}
    {canEdit}
    on:showGroupMembers={showGroupMembers}
    on:close={clickClose}
    on:editGroup={editGroup} />

<div class="group-details">
    <div class="inner">
        <CollapsibleCard
            on:toggle={groupInfoOpen.toggle}
            open={$groupInfoOpen}
            headerText={i18nKey("group.groupInfo", undefined, chat.level)}>
            <div class="sub-section photo">
                <Avatar url={avatarSrc} size={AvatarSize.Large} />

                <h3 class="group-name">{chat.name}</h3>
                <p class="members">
                    <Translatable resourceKey={i18nKey("memberCount", { count: memberCount })} />
                </p>
            </div>

            {#if chat.description?.length > 0}
                <fieldset>
                    <legend>
                        <Legend label={i18nKey("groupDesc", undefined, chat.level)} />
                    </legend>
                    <Markdown text={description(chat)} />
                </fieldset>
            {/if}
        </CollapsibleCard>
        <CollapsibleCard
            on:toggle={groupVisibilityOpen.toggle}
            open={$groupVisibilityOpen}
            headerText={i18nKey("access.visibility")}>
            {#if chat.public}
                <h4>
                    <Translatable
                        resourceKey={i18nKey("group.publicGroup", undefined, chat.level, true)} />
                </h4>
            {:else}
                <h4>
                    <Translatable
                        resourceKey={i18nKey("group.privateGroup", undefined, chat.level, true)} />
                </h4>
            {/if}
            <div class="info">
                {#if chat.public}
                    <Translatable
                        resourceKey={chat.level === "channel"
                            ? i18nKey("publicChannelInfo")
                            : i18nKey("publicGroupInfo", undefined, chat.level, true)} />
                {:else}
                    <p>
                        <Translatable
                            resourceKey={i18nKey(
                                "group.privateGroupInfo",
                                undefined,
                                chat.level,
                                true,
                            )} />
                    </p>
                {/if}
                {#if !chat.public && !embeddedContent}
                    {#if chat.historyVisible}
                        <p><Translatable resourceKey={i18nKey("historyOnInfo")} /></p>
                    {:else}
                        <p><Translatable resourceKey={i18nKey("historyOffInfo")} /></p>
                    {/if}
                {/if}
            </div>
            {#if chat.messagesVisibleToNonMembers}
                <div class="info">
                    <p>
                        <Translatable resourceKey={i18nKey("access.messagesVisibleToNonMembers")} />
                    </p>
                </div>
            {/if}
            {#if !embeddedContent}
                <DisappearingMessagesSummary ttl={chat.eventsTTL} />
            {/if}
            <AccessGateSummary level={chat.level} editable={false} gate={chat.gate} />
        </CollapsibleCard>
        {#if combinedRulesText.length > 0}
            <CollapsibleCard
                on:toggle={groupRulesOpen.toggle}
                open={$groupRulesOpen}
                headerText={i18nKey("rules.rules")}>
                <Markdown inline={false} text={combinedRulesText} />
            </CollapsibleCard>
        {/if}
        {#if canInvite}
            <CollapsibleCard
                on:toggle={groupInviteUsersOpen.toggle}
                open={$groupInviteUsersOpen}
                headerText={i18nKey("invite.inviteWithLink", undefined, chat.level, true)}>
                <InviteUsersWithLink container={chat} />
            </CollapsibleCard>
        {/if}
        <CollapsibleCard
            on:toggle={groupPermissionsOpen.toggle}
            open={$groupPermissionsOpen}
            headerText={i18nKey("permissions.permissions")}>
            <GroupPermissionsViewer bind:permissions={chat.permissions} isPublic={chat.public} />
        </CollapsibleCard>
        {#if !embeddedContent}
            <CollapsibleCard
                on:toggle={groupStatsOpen.toggle}
                open={$groupStatsOpen}
                headerText={i18nKey("stats.groupStats", undefined, chat.level)}>
                <Stats showReported={false} stats={chat.metrics} />
            </CollapsibleCard>
        {/if}
        {#if client.canDeleteGroup(chat.id)}
            <CollapsibleCard
                on:toggle={groupAdvancedOpen.toggle}
                open={$groupAdvancedOpen}
                headerText={i18nKey("group.advanced")}>
                <AdvancedSection on:deleteGroup group={chat} />
            </CollapsibleCard>
        {/if}
    </div>
</div>

<style lang="scss">
    .photo {
        text-align: center;
    }

    fieldset {
        border: 1px solid var(--bd);
        border-radius: var(--rd);
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

    .sub-section {
        padding: $sp4;
        // background-color: var(--sub-section-bg);
        margin-bottom: $sp3;
        // border: 1px solid var(--bd);
        border-radius: var(--rd);
    }

    .info {
        margin-bottom: $sp4;
        @include font(light, normal, fs-90);

        p {
            margin-bottom: $sp4;
            &:last-child {
                margin-bottom: 0;
            }
        }
    }
</style>

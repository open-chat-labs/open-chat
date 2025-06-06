<script lang="ts">
    import type { MultiUserChat, OpenChat } from "openchat-client";
    import {
        AvatarSize,
        currentUserIdStore,
        selectedChatRulesStore,
        selectedCommunityRulesStore,
        selectedCommunitySummaryStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import {
        groupAdvancedOpen,
        groupInfoOpen,
        groupInviteUsersOpen,
        groupPermissionsOpen,
        groupRulesOpen,
        groupStatsOpen,
        groupVisibilityOpen,
    } from "../../../stores/settings";
    import Avatar from "../../Avatar.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import WithVerifiedBadge from "../../icons/WithVerifiedBadge.svelte";
    import Legend from "../../Legend.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccessGateExpiry from "../access/AccessGateExpiry.svelte";
    import AccessGateSummary from "../access/AccessGateSummary.svelte";
    import DisappearingMessagesSummary from "../DisappearingMessagesSummary.svelte";
    import GroupPermissionsViewer from "../GroupPermissionsViewer.svelte";
    import InviteUsersWithLink from "../InviteUsersWithLink.svelte";
    import Markdown from "../Markdown.svelte";
    import Stats from "../Stats.svelte";
    import AdvancedSection from "./AdvancedSection.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
        memberCount: number;
    }

    let { chat = $bindable(), memberCount }: Props = $props();

    let canSend = $derived(client.canSendMessage(chat.id, "any"));
    let canInvite = $derived(
        client.canInviteUsers(chat.id) && (chat.kind !== "channel" || !client.isChatPrivate(chat)),
    );
    let avatarSrc = $derived(client.groupAvatarUrl(chat, $selectedCommunitySummaryStore));
    let combinedRulesText = $derived(
        canSend
            ? client.combineRulesText($selectedChatRulesStore, $selectedCommunityRulesStore)
            : "",
    );
    let externalUrl = $derived(chat.kind === "channel" ? chat.externalUrl : undefined);
    let externalContent = $derived(externalUrl !== undefined);
    let verified = $derived(chat.kind === "group_chat" && chat.verified);

    function description(chat: MultiUserChat): string {
        let description = chat.description;

        if (chat.subtype?.kind === "governance_proposals") {
            description = description.replace("{userId}", $currentUserIdStore);
        }

        return description;
    }
</script>

<div class="group-details">
    <div class="inner">
        <CollapsibleCard
            onToggle={groupInfoOpen.toggle}
            open={$groupInfoOpen}
            headerText={i18nKey("group.groupInfo", undefined, chat.level)}>
            <div class="sub-section photo">
                <Avatar url={avatarSrc} size={AvatarSize.Large} />

                <WithVerifiedBadge
                    {verified}
                    size={"small"}
                    tooltip={i18nKey("verified.verified", undefined, chat.level, true)}>
                    <h3 class="group-name">
                        {chat.name}
                    </h3>
                </WithVerifiedBadge>
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
            {#if externalUrl !== undefined && externalUrl.length > 0}
                <fieldset>
                    <legend>
                        <Legend label={i18nKey("externalContent.label")} />
                    </legend>
                    <Markdown text={externalUrl} />
                </fieldset>
            {/if}
        </CollapsibleCard>
        <CollapsibleCard
            onToggle={groupVisibilityOpen.toggle}
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
                {#if !chat.public && !externalContent}
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
            {#if !externalContent}
                <DisappearingMessagesSummary ttl={chat.eventsTTL} />
            {/if}
            <AccessGateSummary level={chat.level} editable={false} gateConfig={chat.gateConfig} />
            {#if chat.gateConfig.expiry !== undefined}
                <div class="expiry">
                    <AccessGateExpiry expiry={chat.gateConfig.expiry} />
                </div>
            {/if}
        </CollapsibleCard>
        {#if combinedRulesText.length > 0}
            <CollapsibleCard
                onToggle={groupRulesOpen.toggle}
                open={$groupRulesOpen}
                headerText={i18nKey("rules.rules")}>
                <Markdown inline={false} text={combinedRulesText} />
            </CollapsibleCard>
        {/if}
        {#if canInvite}
            <CollapsibleCard
                onToggle={groupInviteUsersOpen.toggle}
                open={$groupInviteUsersOpen}
                headerText={i18nKey("invite.inviteWithLink", undefined, chat.level, true)}>
                <InviteUsersWithLink container={chat} />
            </CollapsibleCard>
        {/if}
        <CollapsibleCard
            onToggle={groupPermissionsOpen.toggle}
            open={$groupPermissionsOpen}
            headerText={i18nKey("permissions.permissions")}>
            <GroupPermissionsViewer
                embeddedContent={externalContent}
                permissions={chat.permissions}
                isPublic={chat.public}
                isCommunityPublic={$selectedCommunitySummaryStore?.public ?? true}
                isChannel={chat.id.kind === "channel"} />
        </CollapsibleCard>
        {#if !externalContent}
            <CollapsibleCard
                onToggle={groupStatsOpen.toggle}
                open={$groupStatsOpen}
                headerText={i18nKey("stats.groupStats", undefined, chat.level)}>
                <Stats showReported={false} stats={chat.metrics} />
            </CollapsibleCard>
        {/if}
        {#if client.canDeleteGroup(chat.id)}
            <CollapsibleCard
                onToggle={groupAdvancedOpen.toggle}
                open={$groupAdvancedOpen}
                headerText={i18nKey("group.advanced")}>
                <AdvancedSection group={chat} />
            </CollapsibleCard>
        {/if}
    </div>
</div>

<style lang="scss">
    .photo {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $sp4;
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
        padding: $sp3 $sp4 0 $sp4;

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
        margin: 0;
    }

    .members {
        @include font(light, normal, fs-90);
    }

    .sub-section {
        padding: $sp4;
        margin-bottom: $sp3;
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

    .expiry {
        color: var(--txt-light);
        @include font(book, normal, fs-90);
        margin-top: $sp3;
    }
</style>

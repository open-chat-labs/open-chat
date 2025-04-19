<script lang="ts">
    import {
        type CommunitySummary,
        type Metrics,
        type ReadonlySet,
        type Rules,
    } from "openchat-client";
    import { i18nKey } from "../../../../i18n/i18n";
    import {
        communityAdvancedOpen,
        communityInviteUsersOpen,
        communityPermissionsOpen,
        communityRulesOpen,
        communityStatsOpen,
        communityVisibilityOpen,
    } from "../../../../stores/settings";
    import CollapsibleCard from "../../../CollapsibleCard.svelte";
    import Translatable from "../../../Translatable.svelte";
    import InviteUsersWithLink from "../../InviteUsersWithLink.svelte";
    import Markdown from "../../Markdown.svelte";
    import Stats from "../../Stats.svelte";
    import AccessGateExpiry from "../../access/AccessGateExpiry.svelte";
    import AccessGateSummary from "../../access/AccessGateSummary.svelte";
    import ReferredUsersList from "../../profile/ReferredUsersList.svelte";
    import PermissionsViewer from "../PermissionsViewer.svelte";
    import AdvancedSection from "./AdvancedSection.svelte";

    interface Props {
        community: CommunitySummary;
        rules: Rules | undefined;
        metrics: Metrics;
        canDelete: boolean;
        canInvite: boolean;
        referrals: ReadonlySet<string>;
    }

    let {
        community = $bindable(),
        rules,
        metrics,
        canDelete,
        canInvite,
        referrals,
    }: Props = $props();
</script>

<div class="details">
    <CollapsibleCard
        onToggle={communityVisibilityOpen.toggle}
        open={$communityVisibilityOpen}
        headerText={i18nKey("access.visibility")}>
        {#if community.public}
            <h4>
                <Translatable
                    resourceKey={i18nKey("group.publicGroup", undefined, community.level, true)} />
            </h4>
        {:else}
            <h4>
                <Translatable
                    resourceKey={i18nKey("group.privateGroup", undefined, community.level, true)} />
            </h4>
        {/if}
        <div class="info">
            {#if community.public}
                <p>
                    <Translatable
                        resourceKey={i18nKey(
                            "publicGroupInfo",
                            undefined,
                            community.level,
                            true,
                        )} />
                </p>
            {:else}
                <p>
                    <Translatable
                        resourceKey={i18nKey(
                            "group.privateGroupInfo",
                            undefined,
                            community.level,
                            true,
                        )} />
                </p>
            {/if}
            {#if !community.public}
                {#if community.historyVisible}
                    <p><Translatable resourceKey={i18nKey("historyOnInfo")} /></p>
                {:else}
                    <p><Translatable resourceKey={i18nKey("historyOffInfo")} /></p>
                {/if}
            {/if}
        </div>
        <AccessGateSummary
            editable={false}
            level={community.level}
            gateConfig={community.gateConfig} />
        {#if community.gateConfig.expiry !== undefined}
            <div class="expiry">
                <AccessGateExpiry expiry={community.gateConfig.expiry} />
            </div>
        {/if}
    </CollapsibleCard>
    {#if rules !== undefined && rules.enabled}
        <CollapsibleCard
            onToggle={communityRulesOpen.toggle}
            open={$communityRulesOpen}
            headerText={i18nKey("rules.levelRules", undefined, community.level)}>
            <Markdown inline={false} text={rules.text} />
        </CollapsibleCard>
    {/if}
    {#if canInvite}
        <CollapsibleCard
            onToggle={communityInviteUsersOpen.toggle}
            open={$communityInviteUsersOpen}
            headerText={i18nKey("invite.inviteWithLink", undefined, community.level, true)}>
            <InviteUsersWithLink container={community} />
        </CollapsibleCard>
    {/if}
    <ReferredUsersList {referrals} />
    <CollapsibleCard
        onToggle={communityPermissionsOpen.toggle}
        open={$communityPermissionsOpen}
        headerText={i18nKey("permissions.permissions")}>
        <PermissionsViewer isPublic={community.public} permissions={community.permissions} />
    </CollapsibleCard>
    <CollapsibleCard
        onToggle={communityStatsOpen.toggle}
        open={$communityStatsOpen}
        headerText={i18nKey("stats.groupStats", undefined, community.level)}>
        <Stats showReported={false} stats={metrics} />
    </CollapsibleCard>
    {#if canDelete}
        <CollapsibleCard
            onToggle={communityAdvancedOpen.toggle}
            open={$communityAdvancedOpen}
            headerText={i18nKey("group.advanced")}>
            <AdvancedSection {community} />
        </CollapsibleCard>
    {/if}
</div>

<style lang="scss">
    .info {
        margin-bottom: $sp4;
    }

    .details {
        margin: 0 $sp4;
        @include mobile() {
            margin: 0 $sp3;
        }
    }

    .expiry {
        color: var(--txt-light);
        @include font(book, normal, fs-90);
        margin-top: $sp3;
    }
</style>

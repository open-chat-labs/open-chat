<script lang="ts">
    import type { AccessRules, Community } from "openchat-client";
    import {
        communityAdvancedOpen,
        communityPermissionsOpen,
        communityRulesOpen,
        communityStatsOpen,
        communityVisibilityOpen,
    } from "../../../../stores/settings";
    import Markdown from "../../Markdown.svelte";
    import AccessGateSummary from "../../AccessGateSummary.svelte";
    import PermissionsViewer from "../PermissionsViewer.svelte";
    import { interpolateLevel } from "../../../../utils/i18n";
    import { _ } from "svelte-i18n";
    import AdvancedSection from "./AdvancedSection.svelte";
    import CollapsibleCard from "../../../CollapsibleCard.svelte";

    export let community: Community;
    export let rules: AccessRules | undefined;
    export let canDelete: boolean;

    // access
    // rules
    // permissions
    // stats?
</script>

<div class="details">
    <CollapsibleCard
        on:toggle={communityVisibilityOpen.toggle}
        open={$communityVisibilityOpen}
        headerText={$_("access.visibility")}>
        {#if community.public}
            <h4>{interpolateLevel("group.publicGroup", community.level, true)}</h4>
        {:else}
            <h4>{interpolateLevel("group.privateGroup", community.level, true)}</h4>
        {/if}
        <div class="info">
            {#if community.public}
                <p>{interpolateLevel("publicGroupInfo", community.level, true)}</p>
            {:else}
                <p>{interpolateLevel("group.privateGroupInfo", community.level, true)}</p>
            {/if}
            {#if !community.public}
                {#if community.historyVisible}
                    <p>{$_("historyOnInfo")}</p>
                {:else}
                    <p>{$_("historyOffInfo")}</p>
                {/if}
            {/if}
        </div>
        <AccessGateSummary gate={community.gate} />
    </CollapsibleCard>
    {#if rules !== undefined && rules.enabled}
        <CollapsibleCard
            on:toggle={communityRulesOpen.toggle}
            open={$communityRulesOpen}
            headerText={interpolateLevel("rules.rules", community.level)}>
            <Markdown inline={false} text={rules.text} />
        </CollapsibleCard>
    {/if}
    <CollapsibleCard
        on:toggle={communityPermissionsOpen.toggle}
        open={$communityPermissionsOpen}
        headerText={$_("permissions.permissions")}>
        <PermissionsViewer bind:permissions={community.permissions} />
    </CollapsibleCard>
    <!-- <CollapsibleCard
                on:toggle={communityStatsOpen.toggle}
                open={$communityStatsOpen}
                headerText={interpolateLevel("stats.groupStats", community.level)}>
                <Stats showReported={false} stats={community.metrics} />
            </CollapsibleCard> -->
    {#if canDelete}
        <CollapsibleCard
            on:toggle={communityAdvancedOpen.toggle}
            open={$communityAdvancedOpen}
            headerText={$_("group.advanced")}>
            <AdvancedSection on:deleteCommunity {community} />
        </CollapsibleCard>
    {/if}
</div>

<style lang="scss">
    .details {
        margin: 0 $sp4;
        @include mobile() {
            margin: 0 $sp3;
        }
    }
</style>

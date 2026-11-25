<!-- A community's Channels, Rules or Access gates, read only, for a member who may not change
     them (the details' Info card): the user's channels (a tap opens one), the rules as written
     ("No rules" while they're off), or the gates as the preview's Requirements card lists them,
     without the statuses (the reader is a member). -->
<script lang="ts">
    import {
        enhancedCryptoLookup,
        routeForChatIdentifier,
        type CommunitySummary,
        type OpenChat,
        type VersionedRules,
    } from "@client";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import { appStoreBuild } from "@src/utils/features";
    import { navigate } from "@src/utils/navigation";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { ScreenContext } from "../app/screens";
    import ChannelsCard from "../communities/ChannelsCard.svelte";
    import { requirementCard } from "../communities/communityPreview.adapter";
    import RequirementsCard from "../communities/RequirementsCard.svelte";
    import TextRow from "../details/TextRow.svelte";

    type Props = {
        community: CommunitySummary;
        rules: VersionedRules | undefined;
        page: "channels" | "rules" | "gates";
        context: ScreenContext;
    };

    let { community, rules, page, context }: Props = $props();

    const client = getContext<OpenChat>("client");

    const gates = $derived.by(() => {
        const gate = client.accessGatesForCommunity(community, true)[0];
        return gate === undefined
            ? undefined
            : requirementCard(
                  gate,
                  (g) => client.doesUserMeetAccessGate(g),
                  $enhancedCryptoLookup,
                  appStoreBuild,
              );
    });
    const rulesText = $derived(rules?.enabled ? rules.text : "");
</script>

<div class="page">
    <NativePageHeader
        title={$_(
            page === "channels"
                ? "native.community.manage.channels"
                : page === "rules"
                  ? "native.details.manage.rules"
                  : "native.details.manage.gates",
        )}
        sub={community.name}
        onBack={context.back} />

    <div class="body">
        {#if page === "channels"}
            <ChannelsCard
                label=""
                channels={community.channels}
                onOpen={(id) => navigate(routeForChatIdentifier("community", id))} />
        {:else if page === "rules"}
            {#if rulesText !== ""}
                <SettingsGroup>
                    <TextRow text={rulesText} />
                </SettingsGroup>
            {:else}
                <p class="none">{$_("native.communityDetails.noRules")}</p>
            {/if}
        {:else if gates !== undefined && gates.rows.length > 0}
            <RequirementsCard label={$_("native.details.manage.gates")} card={gates} status={false} />
        {:else}
            <p class="none">{$_("native.communityDetails.noGates")}</p>
        {/if}
    </div>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .page {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: 8px var(--space-16) var(--scroll-end);
    }

    .none {
        margin: 0;
        padding: 12px 4px;
        text-align: center;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-3);
    }
</style>

<!-- A community's details (native plan 12 "Community details", Design Notes §3.8), pushed from its page's header
     and its menu's Manage, without a URL of its own (as the web opens its panel): the cover (its banner) with back,
     its avatar, name and "Public · 1,284 members"; About (the description, its language); then, read only for
     every member, its Channels (a tap opens one), Rules and Access gates (the preview's card, without the
     statuses); and for owners and admins the cover's Edit (Edit community) and Manage (Channels, User groups,
     Invite and share, Access gates, Rules, Permissions, Bots and webhooks, Stats: N7's settings pages). -->
<script lang="ts">
    import {
        anonUserStore,
        communitiesStore,
        enhancedCryptoLookup,
        routeForChatIdentifier,
        selectedCommunityIdStore,
        selectedCommunityRulesStore,
        type OpenChat,
    } from "@client";
    import { supportedLanguagesByCode } from "@i18n/i18n";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsLink from "@openchat/ui/src/native/SettingsLink.svelte";
    import { communityDetailsPermissions } from "@src/logic/groupOrCommunity/detailsPermissions";
    import { swatchFor } from "@src/logic/swatch";
    import { appStoreBuild } from "@src/utils/features";
    import { navigate } from "@src/utils/navigation";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import DetailsHead from "../details/DetailsHead.svelte";
    import { showsManage } from "../details/details.adapter";
    import FactRow from "../details/FactRow.svelte";
    import TextRow from "../details/TextRow.svelte";
    import ChannelsCard from "./ChannelsCard.svelte";
    import { communityManageRows } from "./community.adapter";
    import { requirementCard } from "./communityPreview.adapter";
    import RequirementsCard from "./RequirementsCard.svelte";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "community_details" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    const community = $derived($communitiesStore.get(screen.communityId));

    const sub = $derived(
        community === undefined
            ? ""
            : $_("native.conversation.members", {
                  values: {
                      visibility: $_(community.public ? "access.public" : "access.private"),
                      count: community.memberCount,
                  },
              }),
    );
    const language = $derived(
        community === undefined
            ? undefined
            : supportedLanguagesByCode[community.primaryLanguage]?.name,
    );

    // its rules, held for the selected community (this one: the screen is over its page)
    const rules = $derived(
        community !== undefined &&
            $selectedCommunityIdStore?.communityId === community.id.communityId &&
            $selectedCommunityRulesStore?.enabled
            ? $selectedCommunityRulesStore.text
            : "",
    );

    // its access gates, as the preview's Requirements card lists them (without the statuses: the
    // reader is a member)
    const gates = $derived.by(() => {
        if (community === undefined) return undefined;
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

    // owners and admins, as a group's details (showsManage), who may edit it
    const manage = $derived(
        community !== undefined &&
            communityDetailsPermissions(client, community, $anonUserStore).canEdit &&
            showsManage(community.membership.role, client.isCommunityFrozen(community.id)),
    );
</script>

<div class="details">
    {#if community === undefined}
        <!-- gone (left, a moment after a cold start): Back stays -->
        <NativePageHeader title="" onBack={context.back} />
    {:else}
        <div class="scroll">
            <DetailsHead
                title={community.name}
                {sub}
                locked={!community.public}
                coverUrl={community.banner.blobUrl}
                photoUrl={community.avatar.blobUrl}
                color={swatchFor(community.id.communityId)}
                square
                favourite={false}
                onBack={context.back}
                onFavourite={undefined}
                onMore={undefined}
                onEdit={manage
                    ? () =>
                          context.push({
                              kind: "community_settings",
                              communityId: community.id,
                              page: "edit",
                          })
                    : undefined}
                editLabel={$_("native.communitySettings.edit")} />

            <div class="content">
                <SettingsGroup label={$_("native.you.about")}>
                    {#if community.description !== ""}
                        <TextRow text={community.description} />
                    {/if}
                    {#if language !== undefined}
                        <FactRow label={$_("native.community.language")} value={language} />
                    {/if}
                </SettingsGroup>

                {#if community.channels.length > 0}
                    <ChannelsCard
                        label={$_("native.community.preview.channels")}
                        channels={community.channels}
                        onOpen={(id) => navigate(routeForChatIdentifier("community", id))} />
                {/if}

                {#if rules !== ""}
                    <SettingsGroup label={$_("native.details.rules")}>
                        <TextRow text={rules} />
                    </SettingsGroup>
                {/if}

                {#if gates !== undefined && gates.rows.length > 0}
                    <RequirementsCard
                        label={$_("native.details.manage.gates")}
                        card={gates}
                        status={false} />
                {/if}

                {#if manage}
                    <SettingsGroup label={$_("native.details.manage.title")}>
                        {#each communityManageRows((key) => $_(key)) as row (row.page)}
                            <SettingsLink
                                icon={row.icon}
                                label={row.label}
                                onClick={() =>
                                    context.push({
                                        kind: "community_settings",
                                        communityId: community.id,
                                        page: row.page,
                                    })} />
                        {/each}
                    </SettingsGroup>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style lang="scss">
    .details {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
    }

    .content {
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: 20px var(--space-16) var(--scroll-end);
    }
</style>

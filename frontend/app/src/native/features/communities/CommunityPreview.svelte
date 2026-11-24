<!-- A community being previewed (N8b PR 3, native plan 12 "Preview and join", Design Notes §3.8 Preview): the
     cover with Back and Share, the avatar, name, "Public · 1,284 members · English" and about; the Requirements
     card, each requirement with the user's status (communityPreview.adapter: the requirements sheet's rows); the
     public channels, each opening the channel to read with the join bar in the composer's place; Join at the foot
     (JoinButton: the requirements sheet first where joining has any). Joined, the community's own page takes its
     place (CommunityScreen). -->
<script lang="ts">
    import {
        anonUserStore,
        communitiesStore,
        cryptoBalanceStore,
        currentUserStore,
        enhancedCryptoLookup,
        routeForChatIdentifier,
        type CommunitySummary,
        type OpenChat,
    } from "@client";
    import { supportedLanguagesByCode } from "@i18n/i18n";
    import { communityPreviewBar } from "@src/logic/join/previewBar";
    import { swatchFor } from "@src/logic/swatch";
    import { appStoreBuild } from "@src/utils/features";
    import { navigate } from "@src/utils/navigation";
    import { shareLink } from "@src/utils/share";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { ScreenContext } from "../app/screens";
    import DetailsHead from "../details/DetailsHead.svelte";
    import { joinButton } from "../join/joinBar.adapter";
    import JoinButton from "../join/JoinButton.svelte";
    import ChannelsCard from "./ChannelsCard.svelte";
    import { requirementCard } from "./communityPreview.adapter";
    import RequirementsCard from "./RequirementsCard.svelte";

    type Props = { community: CommunitySummary; context: ScreenContext };

    let { community, context }: Props = $props();

    const client = getContext<OpenChat>("client");

    // what the client's calls read through `.value`, so these follow it: a lapse or a join (the
    // communities), Diamond bought or CHIT earned (the user), a top-up (balances)
    const bar = $derived.by(() => {
        void [$communitiesStore, $currentUserStore, $cryptoBalanceStore];
        return communityPreviewBar(client, community, $anonUserStore);
    });
    const join = $derived(joinButton(bar, "community"));
    const card = $derived.by(() => {
        void [$currentUserStore, $cryptoBalanceStore];
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

    const meta = $derived(
        [
            $_("native.conversation.members", {
                values: {
                    visibility: $_(community.public ? "access.public" : "access.private"),
                    count: community.memberCount,
                },
            }),
            supportedLanguagesByCode[community.primaryLanguage]?.name,
        ]
            .filter((part) => part)
            .join(" · "),
    );
    // the channels someone not in the community can read
    const channels = $derived(community.channels.filter((c) => c.public));

    // pushed over Explore (N8a: locations), it goes back there; at the tab's root (a cold link,
    // before the community is known) it cancels the preview, back where it was opened from
    function back() {
        if (context.back !== undefined) context.back();
        else navigate(client.cancelPreview(community.id));
    }

    function share() {
        void shareLink(`${client.canonicalOrigin()}/community/${community.id.communityId}`);
    }

    // toasts over Join, not behind it (the shell's floor is the tab bar's)
    let footer = $state<HTMLElement>();
    $effect(() => {
        const el = footer;
        if (el === undefined) return;
        const observer = new ResizeObserver(() =>
            context.toastFloor(window.innerHeight - el.getBoundingClientRect().top),
        );
        observer.observe(el);
        return () => {
            observer.disconnect();
            context.toastFloor(undefined);
        };
    });
</script>

<div class="preview">
    <div class="scroll">
        <DetailsHead
            title={community.name}
            sub={meta}
            coverUrl={community.banner.blobUrl}
            photoUrl={community.avatar.blobUrl}
            color={swatchFor(community.id.communityId)}
            square
            favourite={false}
            onBack={back}
            onFavourite={undefined}
            onMore={undefined}
            onShare={share} />
        <div class="body">
            {#if community.description}
                <p class="about">{community.description}</p>
            {/if}
            {#if card !== undefined && card.rows.length > 0}
                <RequirementsCard
                    label={$_("native.community.preview.requirements")}
                    {card}
                    status />
            {/if}
            {#if channels.length > 0}
                <ChannelsCard
                    label={$_("native.community.preview.channels")}
                    note={$_("native.community.preview.channelsNote")}
                    {channels}
                    onOpen={(id) => navigate(routeForChatIdentifier("community", id))} />
            {/if}
        </div>
    </div>
    <div class="foot" bind:this={footer}>
        <JoinButton {bar} view={join} overlays={context.overlays} toast={(m) => context.toast(m)} />
    </div>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .preview {
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

    // the design's: 12px under the line, 20px between the about and the cards
    .body {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 12px 16px 24px;
    }

    .about {
        margin: 0;
        font: 400 14.5px/1.5 var(--font-sans);
        color: var(--ink-2);
        text-wrap: pretty;
    }

    // Join on the tab's root, over the tab bar
    .foot {
        flex: none;
        padding: 12px 16px;
        background: var(--surface-0);
        box-shadow: inset 0 1px 0 var(--line-1);
    }
</style>

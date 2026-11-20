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
        type ResourceKey,
    } from "@client";
    import { interpolateNewUi, supportedLanguagesByCode } from "@i18n/i18n";
    import Icon from "@openchat/ui/src/lib/components/Icon.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
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
    import { requirementCard } from "./communityPreview.adapter";

    type Props = { community: CommunitySummary; context: ScreenContext };

    let { community, context }: Props = $props();

    const client = getContext<OpenChat>("client");
    const text = (key: ResourceKey) => interpolateNewUi($_, key);

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

    // a pushed preview goes back; the tab's root cancels the preview, back where it was opened from
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
                <SettingsGroup
                    label={$_("native.community.preview.requirements")}
                    note={card.notes.map(text).join(" ")}>
                    {#each card.rows as row (row.id)}
                        <div class="settings-row requirement">
                            <span class="req-icon"><Icon icon={row.icon} size={19} /></span>
                            <span class="texts">
                                <span class="label">{text(row.label)}</span>
                                {#if row.detail !== undefined}
                                    <span class="detail">{text(row.detail)}</span>
                                {/if}
                            </span>
                            <span
                                class="status"
                                class:met={row.state === "met"}
                                class:short={row.state === "short"}>
                                {#if row.state === "met"}<Icon icon="check" size={13} />{/if}
                                {text(row.status)}
                            </span>
                        </div>
                    {/each}
                </SettingsGroup>
            {/if}
            {#if channels.length > 0}
                <SettingsGroup
                    label={$_("native.community.preview.channels")}
                    note={$_("native.community.preview.channelsNote")}>
                    {#each channels as channel (channel.id.channelId)}
                        <button
                            type="button"
                            class="settings-row channel"
                            onclick={() =>
                                navigate(routeForChatIdentifier("community", channel.id))}>
                            <span class="hash">#</span>
                            <span class="channel-name">{channel.name}</span>
                            <span class="count">
                                {$_("native.community.preview.channelMembers", {
                                    values: { count: channel.memberCount },
                                })}
                            </span>
                            <span class="chevron"></span>
                        </button>
                    {/each}
                </SettingsGroup>
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

    .requirement {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 60px;
        padding: 10px 16px;
        box-sizing: border-box;
    }

    .req-icon {
        flex: none;
        display: flex;
        color: var(--ink-3);
    }

    .texts {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .label {
        font: 500 15px/1.2 var(--font-sans);
    }

    .detail {
        font: 500 12.5px/1.3 var(--font-sans);
        color: var(--ink-4);
    }

    .status {
        flex: none;
        display: flex;
        align-items: center;
        gap: 5px;
        font: 600 12.5px/1 var(--font-sans);
        color: var(--ink-3);

        &.met {
            color: var(--status-online);
        }

        &.short {
            color: var(--status-warning);
        }
    }

    .channel {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-height: 52px;
        padding: 0 16px;
        border: 0;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .hash {
        font: 700 16px/1 var(--font-mono);
        color: var(--ink-4);
    }

    .channel-name {
        flex: 1;
        min-width: 0;
        font: 500 15px/1.2 var(--font-sans);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .count {
        font: 500 12.5px/1 var(--font-sans);
        color: var(--ink-4);
    }

    .chevron {
        flex: none;
        @include icon(chevron-right, 14px);
        color: var(--ink-4);

        &:dir(rtl) {
            transform: rotate(180deg);
        }
    }

    // Join on the tab's root, over the tab bar
    .foot {
        flex: none;
        padding: 12px 16px;
        background: var(--surface-0);
        box-shadow: inset 0 1px 0 var(--line-1);
    }
</style>

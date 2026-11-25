<!-- A community's details (the user's design prompt of 2026-11-25 on the native plan's 12 "Community
     details"), pushed from its page's header and its menu's Manage, without a URL of its own (as the
     web opens its panel). One page that scrolls:
     - the cover (its banner) with Back, Share (a public community's link: the preview's share) and
       ⋯ (Edit community for those who may edit it, Mark all as read);
     - the avatar, the name and "Public · 1,248 members";
     - the tiles Invite (for those who may invite: communityInviteAccess), Search (TODO(design): no
       search of a community's own to open, so it's shown disabled) and Mute / Unmute;
     - About (the description, then its language; when it was created isn't known to the client:
       TODO);
     - Members (a few faces, the count) to the Members screen (plan 10) and, for a regular member,
       Channels, Rules and Access gates, read only;
     - Manage for owners and admins, each row with what it holds (Channels, User groups, Invite and
       share, Access gates, Rules, Permissions, Bots and webhooks, Stats: N7's settings pages);
     - "You in this community": Mute all channels, the Mute tile's setting (every channel of the
       user's muted), both ways (the client's muteAllChannels, which can unmute them all too);
     - Leave, or Delete for the owner, each confirmed in a small alert, then gone with Undo
       (removeCommunityWithUndo, as the page's menu's Leave).
     A community has no moderators (owner, admin and member are its roles), so Manage is for owners
     and admins, who may edit what the app's permission checks let them (the pages' own). -->
<script lang="ts">
    import {
        allChatsStore,
        allUsersStore,
        anonUserStore,
        chatsInScope,
        communitiesStore,
        compareMembers,
        favouritesStore,
        knownMembers,
        ROLE_NONE,
        ROLE_OWNER,
        selectedCommunityBotsStore,
        selectedCommunityIdStore,
        selectedCommunityMembersStore,
        selectedCommunityRulesStore,
        sortedCommunitiesStore,
        type OpenChat,
    } from "@client";
    import { supportedLanguagesByCode } from "@i18n/i18n";
    import AvatarStack from "@openchat/ui/src/lib/components/AvatarStack.svelte";
    import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import AnchoredMenu from "@openchat/ui/src/native/AnchoredMenu.svelte";
    import NativeAlert from "@openchat/ui/src/native/NativeAlert.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsLink from "@openchat/ui/src/native/SettingsLink.svelte";
    import SettingsSwitch from "@openchat/ui/src/native/SettingsSwitch.svelte";
    import type { NativeMenuItem } from "@openchat/ui/src/native/types";
    import { i18nKey, interpolateNewUi } from "@src/i18n/i18n";
    import { senderColor } from "@src/logic/conversation/messageRow";
    import {
        communityDetailsPermissions,
        communityMenuPermissions,
    } from "@src/logic/groupOrCommunity/detailsPermissions";
    import { communityInviteAccess, inviteRole } from "@src/logic/members/invitePeople";
    import { swatchFor } from "@src/logic/swatch";
    import { shareLink } from "@src/utils/share";
    import { getContext, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import DetailsHead from "../details/DetailsHead.svelte";
    import DetailTiles from "../details/DetailTiles.svelte";
    import type { DetailTileId } from "../details/details.adapter";
    import TextRow from "../details/TextRow.svelte";
    import { shownGates } from "../groupSettings/settings.adapter";
    import { communityKey, communityManageRows } from "./community.adapter";
    import {
        allChannelsMuted,
        communityTiles,
        dangerAction,
        detailsSections,
        infoRows,
        manageMeta,
        muteHelp,
        rulesCount,
        type ManageState,
    } from "./communityDetails.adapter";
    import { removeCommunityWithUndo } from "./leaveCommunity";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "community_details" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    const overlays = untrack(() => context.overlays);
    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });

    const community = $derived($communitiesStore.get(screen.communityId));
    const selected = $derived(
        $selectedCommunityIdStore?.communityId === screen.communityId.communityId,
    );

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
            : (supportedLanguagesByCode[community.primaryLanguage]?.name ??
                  community.primaryLanguage),
    );

    // ---- who sees what (the app's checks: detailsPermissions, communityInviteAccess)

    const role = $derived(community?.membership?.role ?? ROLE_NONE);
    const frozen = $derived(community !== undefined && client.isCommunityFrozen(community.id));
    const permissions = $derived(
        community === undefined
            ? undefined
            : communityDetailsPermissions(client, community, $anonUserStore),
    );
    const menuPermissions = $derived(
        community === undefined ? undefined : communityMenuPermissions(client, community),
    );
    const sections = $derived(detailsSections(role, permissions?.canEdit ?? false, frozen));
    const inviteAccess = $derived(
        community === undefined
            ? undefined
            : communityInviteAccess(client, community, $anonUserStore),
    );
    const danger = $derived(
        dangerAction(
            (permissions?.canDelete ?? false) && role === ROLE_OWNER,
            menuPermissions?.canLeave ?? false,
        ),
    );

    // ---- the mute: every channel of the user's in it muted, the tile's and the switch's setting

    const channels = $derived(
        community === undefined
            ? []
            : [
                  ...chatsInScope(
                      { kind: "community", id: community.id },
                      $allChatsStore,
                      $favouritesStore,
                  ).values(),
              ],
    );
    const muted = $derived(allChannelsMuted(channels));
    let muting = $state(false);

    async function setMuted(next: boolean) {
        if (community === undefined || muting) return;
        muting = true;
        try {
            const done = await client.muteAllChannels(community.id, false, next);
            context.toast(
                $_(
                    done
                        ? next
                            ? "native.community.toast.mutedAll"
                            : "native.communityDetails.unmutedAll"
                        : next
                          ? "native.community.toast.muteFailed"
                          : "native.communityDetails.unmuteFailed",
                ),
            );
        } finally {
            muting = false;
        }
    }

    // ---- the tiles

    const tiles = $derived(
        communityTiles({ canInvite: inviteAccess?.kind === "allowed", muted }, t),
    );

    function onTile(id: DetailTileId) {
        if (community === undefined) return;
        switch (id) {
            case "invite":
                if (inviteAccess?.kind === "allowed") {
                    context.push({ kind: "community_settings", communityId: community.id, page: "invite" });
                } else {
                    context.toast(
                        interpolateNewUi(
                            $_,
                            i18nKey(
                                `native.invite.notAllowed.${inviteRole(community.permissions.inviteUsers)}`,
                                undefined,
                                "community",
                                true,
                            ),
                        ),
                    );
                }
                return;
            case "mute":
                void setMuted(!muted);
                return;
            default:
                // Search: TODO(design), disabled
                return;
        }
    }

    // ---- Members and the Info card

    const members = $derived(
        selected
            ? knownMembers($allUsersStore, $selectedCommunityMembersStore.values()).sort(
                  compareMembers,
              )
            : [],
    );
    const faces = $derived(
        members.slice(0, 4).map((m) => ({
            src: m.blobUrl,
            grad: AVATAR_GRADIENTS[senderColor(m.userId)],
        })),
    );
    const rules = $derived(selected ? $selectedCommunityRulesStore : undefined);
    const gates = $derived(community === undefined ? 0 : shownGates(community.gateConfig).length);
    const info = $derived(
        infoRows(
            { channels: community?.channels.length ?? 0, rules: rulesCount(rules), gates },
            t,
        ),
    );

    // ---- Manage: what each row holds; the invite link's state is loaded (a public one's is on)

    let link = $state<"on" | "off" | undefined>();
    onMount(async () => {
        const c = untrack(() => community);
        if (c === undefined || !untrack(() => sections.manage)) return;
        if (c.public) {
            link = "on";
            return;
        }
        if (untrack(() => inviteAccess?.kind) !== "allowed") return;
        const loaded = await client.getInviteLink(c);
        link =
            loaded.kind === "enabled" || loaded.kind === "public"
                ? "on"
                : loaded.kind === "failed"
                  ? undefined
                  : "off";
    });
    const manageState = $derived<ManageState | undefined>(
        community === undefined
            ? undefined
            : {
                  channels: community.channels.length,
                  userGroups: community.userGroups.size,
                  link: community.public ? "on" : link,
                  gates,
                  rulesEnabled: rules?.enabled ?? false,
                  permissions: community.permissions,
                  bots: selected ? $selectedCommunityBotsStore.size : 0,
              },
    );

    // ---- the cover's Share and ⋯

    // TODO(design): Share isn't designed; a public community's link is shared as its preview
    // shares it (a private one's is Invite and share's, so it has none here)
    function share() {
        if (community !== undefined) {
            void shareLink(`${client.canonicalOrigin()}/community/${community.id.communityId}`);
        }
    }

    // TODO(design): the ⋯ isn't designed; it holds what the page's menu has that the details
    // don't (Edit community, for those who may edit it, and Mark all as read)
    let menuAnchor = $state<HTMLElement | null>(null);
    useOverlay(
        overlays,
        () => menuAnchor !== null,
        () => (menuAnchor = null),
    );
    const menuItems = $derived<NativeMenuItem[]>([
        ...(sections.manage
            ? [{ id: "edit", label: $_("native.communitySettings.edit"), icon: "edit" }]
            : []),
        { id: "mark_all_read", label: $_("markAllRead"), icon: "check-double" },
    ]);

    function onMenu(id: string) {
        if (community === undefined) return;
        if (id === "edit") {
            context.push({ kind: "community_settings", communityId: community.id, page: "edit" });
        } else if (id === "mark_all_read") {
            for (const chat of channels) client.markAllRead(chat);
            context.toast($_("native.chats.toast.allRead"));
        }
    }

    // ---- Leave or Delete: confirmed first, then gone with Undo

    let confirming = $state(false);
    useOverlay(
        overlays,
        () => confirming,
        () => (confirming = false),
    );

    function remove() {
        confirming = false;
        if (community === undefined || danger === undefined) return;
        removeCommunityWithUndo(
            client,
            context,
            community,
            danger,
            community.id,
            $sortedCommunitiesStore
                .filter((c) => !context.removals.has(communityKey(c.id)))
                .map((c) => ({ id: c.id })),
            $_(danger === "delete" ? "native.communityDetails.deleted" : "native.community.toast.left", {
                values: { name: community.name },
            }),
        );
    }
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
                onShare={community.public ? share : undefined}
                onMore={(anchor) => (menuAnchor = anchor)} />

            <div class="content">
                <DetailTiles {tiles} {onTile} />

                {#if community.description !== "" || language !== undefined}
                    <div class="card about">
                        {#if community.description !== ""}
                            <TextRow text={community.description} />
                        {/if}
                        {#if language !== undefined}
                            <div class="facts" class:first={community.description === ""}>
                                <span class="fact">
                                    <span class="fact-label">{$_("native.communityDetails.language")}</span>
                                    <span class="fact-value">{language}</span>
                                </span>
                            </div>
                        {/if}
                    </div>
                {/if}

                <SettingsGroup>
                    <button
                        type="button"
                        class="settings-row members-row"
                        onclick={() =>
                            context.push({ kind: "community_members", communityId: community.id })}>
                        <span class="members-icon" aria-hidden="true"></span>
                        <span class="members-text">
                            <span class="members-label">{$_("members")}</span>
                            <span class="members-count">{community.memberCount.toLocaleString()}</span>
                        </span>
                        <AvatarStack people={faces} max={4} size={26} ring="var(--surface-0)" />
                        <span class="chevron"></span>
                    </button>
                    {#if sections.info}
                        {#each info as row (row.page)}
                            <SettingsLink
                                icon={row.icon}
                                label={row.label}
                                value={row.value}
                                onClick={() =>
                                    context.push({
                                        kind: "community_settings",
                                        communityId: community.id,
                                        page: row.page,
                                    })} />
                        {/each}
                    {/if}
                </SettingsGroup>

                {#if sections.manage && manageState !== undefined}
                    {@const state = manageState}
                    <SettingsGroup label={$_("native.details.manage.title")}>
                        {#each communityManageRows((key) => $_(key)) as row (row.page)}
                            {@const meta = manageMeta(row.page, state, t)}
                            <SettingsLink
                                icon={row.icon}
                                label={row.label}
                                value={meta?.value ?? ""}
                                quiet={meta !== undefined && !meta.set}
                                onClick={() =>
                                    context.push({
                                        kind: "community_settings",
                                        communityId: community.id,
                                        page: row.page,
                                    })} />
                        {/each}
                    </SettingsGroup>
                {/if}

                {#if role !== ROLE_NONE}
                    <div class="section">
                        <div class="label"><ListSectionLabel label={$_("native.communityDetails.you")} /></div>
                        <SettingsGroup>
                            <SettingsSwitch
                                label={$_("native.communityDetails.muteAll")}
                                help={muteHelp(muted, t)}
                                on={muted}
                                disabled={muting || channels.length === 0}
                                onChange={(on) => void setMuted(on)} />
                        </SettingsGroup>
                    </div>
                {/if}

                {#if danger !== undefined}
                    <SettingsGroup>
                        <SettingsAction
                            icon={danger === "delete" ? "trash" : "exit"}
                            label={$_(
                                danger === "delete"
                                    ? "native.communityDetails.delete"
                                    : "native.communityDetails.leave",
                            )}
                            danger
                            onClick={() => (confirming = true)} />
                    </SettingsGroup>
                {/if}
            </div>
        </div>
    {/if}
</div>

<AnchoredMenu
    anchor={menuAnchor}
    items={menuItems}
    label={$_("native.community.options")}
    onSelect={onMenu}
    onClose={() => (menuAnchor = null)} />

<NativeAlert
    open={confirming}
    title={$_(
        danger === "delete"
            ? "native.communityDetails.deleteTitle"
            : "native.communityDetails.leaveTitle",
        { values: { name: community?.name ?? "" } },
    )}
    message={$_(
        danger === "delete"
            ? "native.communityDetails.deleteMessage"
            : "native.communityDetails.leaveMessage",
    )}
    confirmLabel={$_(
        danger === "delete"
            ? "native.communityDetails.deleteConfirm"
            : "native.communityDetails.leaveConfirm",
    )}
    cancelLabel={$_("cancel")}
    danger
    onConfirm={remove}
    onClose={() => (confirming = false)} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

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
        gap: 20px;
        padding: 20px var(--space-16) var(--scroll-end);
    }

    .card {
        border-radius: 16px;
        background: var(--overlay-1);
        overflow: hidden;
    }

    // About's facts under the description, past a hairline
    .facts {
        display: flex;
        box-shadow: inset 0 1px 0 var(--line-1);

        &.first {
            box-shadow: none;
        }
    }

    .fact {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px 16px;
    }

    .fact-label {
        font: var(--weight-medium) text-size(10px) / 1.2 var(--font-mono);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-4);
    }

    .fact-value {
        font: 700 text-size(15px) / 1.3 var(--font-sans);
        color: var(--ink);
        @include truncate;
    }

    .members-row {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 60px;
        padding: 10px 16px;
        box-sizing: border-box;
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

    .members-icon {
        @include icon(users, 19px, var(--ink-3));
        flex: none;
    }

    .members-text {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: baseline;
        gap: 8px;
    }

    .members-label {
        font: var(--weight-medium) text-size(15px) / 1.2 var(--font-sans);
    }

    .members-count {
        font: var(--weight-medium) text-size(13px) / 1.2 var(--font-sans);
        color: var(--ink-4);
    }

    .chevron {
        @include icon(chevron-right, 14px, var(--ink-4));
        flex: none;

        &:dir(rtl) {
            transform: scaleX(-1);
        }
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .label {
        padding-inline-start: 4px;
    }
</style>

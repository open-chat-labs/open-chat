<!-- A group's or channel's details (native plan 10, Design Notes §3.6): the cover (a channel's is its
     community's banner) with back, favourite and a kebab (Edit group, N7's page; Copy invite link,
     for someone who may share it); the avatar, the name and "Private · 48 members"; the tiles Mute
     / Search / Invite; About (the description, when it was created, whether new members see the
     history); Members, a few faces and View all, to the Members screen; This chat (the
     disappearing messages, the library's TimedToggle for those its settings let change them
     (DisappearingRow), read only for the rest, then muting @everyone); the rules, read only; Manage for owners and admins (Access gates, Rules,
     Permissions, Bots and webhooks, Stats: N7's screens); Leave and Delete, each with Undo. What
     the viewer may do is the web panel's (logic/groupOrCommunity/detailsPermissions). -->
<script lang="ts">
    import {
        allUsersStore,
        anonUserStore,
        chatIdentifierToString,
        chatListScopeStore,
        compareMembers,
        currentUserIdStore,
        favouritesStore,
        groupDescription,
        knownMembers,
        ROLE_NONE,
        routeForScope,
        selectedChatMembersStore,
        selectedChatRulesStore,
        selectedCommunityRulesStore,
        selectedCommunitySummaryStore,
        type GroupCreation,
        type MultiUserChat,
        type OpenChat,
    } from "@client";
    import { copyText } from "@openchat/ui/src/lib/clipboard";
    import AnchoredMenu from "@openchat/ui/src/native/AnchoredMenu.svelte";
    import AvatarStack from "@openchat/ui/src/lib/components/AvatarStack.svelte";
    import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsLink from "@openchat/ui/src/native/SettingsLink.svelte";
    import SettingsSwitch from "@openchat/ui/src/native/SettingsSwitch.svelte";
    import type { NativeMenuItem } from "@openchat/ui/src/native/types";
    import { chatMenuActions } from "@src/logic/chats/chatMenu";
    import { muteChat } from "@src/logic/chats/muteChat";
    import { senderColor } from "@src/logic/conversation/messageRow";
    import {
        canChangeDisappearing,
        chatDetailsPermissions,
        chatRulesText,
    } from "@src/logic/groupOrCommunity/detailsPermissions";
    import { MemberManagement } from "@src/logic/members/memberManagement.svelte";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onMount, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenContext } from "../app/screens";
    import { favouriteWithToast, muteWithToast } from "../chats/chatToasts";
    import { removeWithUndo } from "../chats/removeWithUndo";
    import { requestSearch } from "../conversation/searchRequests";
    import DetailsHead from "./DetailsHead.svelte";
    import DetailTiles from "./DetailTiles.svelte";
    import DisappearingRow from "./DisappearingRow.svelte";
    import FactRow from "./FactRow.svelte";
    import TextRow from "./TextRow.svelte";
    import { openInvite } from "./openInvite";
    import {
        createdFacts,
        disappearingValue,
        groupTiles,
        historyValue,
        manageRows,
        showsManage,
        type DetailTileId,
    } from "./details.adapter";

    let { chat, context }: { chat: MultiUserChat; context: ScreenContext } = $props();

    const client = getContext<OpenChat>("client");
    const overlays = untrack(() => context.overlays);

    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });

    const channel = $derived(chat.kind === "channel");
    const community = $derived(channel ? $selectedCommunitySummaryStore : undefined);
    const me = $derived($currentUserIdStore);
    const member = $derived(chat.membership.role !== ROLE_NONE);
    const favourite = $derived($favouritesStore.has(chat.id));
    const muted = $derived(chat.membership.notificationsMuted);
    const frozen = $derived(
        client.isChatFrozen(chat.id) ||
            (community !== undefined && client.isCommunityFrozen(community.id)),
    );
    const permissions = $derived(
        chatDetailsPermissions(client, chat, community, $anonUserStore),
    );

    const sub = $derived(
        t("native.conversation.members", {
            visibility: t(chat.public ? "access.public" : "access.private"),
            count: chat.memberCount,
        }),
    );

    // Invite is every member's (not in a frozen chat): it opens Invite people for those who may
    // invite or add, and in a public group; it says who can otherwise (logic/members/invitePeople)
    const tiles = $derived(groupTiles({ canInvite: member && !frozen, muted }, t));

    // ---- About, and the Members row: the members held (a large group's first page), highest
    // role first, as the web's panel lists them

    const description = $derived(groupDescription(chat, me));
    const members = $derived(
        knownMembers($allUsersStore, $selectedChatMembersStore.values()).sort(compareMembers),
    );

    // when it was created and by whom: its first event, read once as the screen opens (the screen
    // is this chat's for its life), and its creator's name, loaded if it isn't held (they may have
    // left). Nothing shows until then, nor where it can't be read (the history before the reader
    // joined is hidden)
    let created = $state<GroupCreation>();
    onMount(async () => {
        created = await client.groupCreated(untrack(() => chat));
        if (created !== undefined && allUsersStore.value.get(created.createdBy) === undefined) {
            client
                .getUser(created.createdBy, true)
                .catch((e) => console.warn("Couldn't load the group's creator", e));
        }
    });
    const createdRows = $derived(
        createdFacts(
            created,
            created === undefined ? undefined : $allUsersStore.get(created.createdBy)?.username,
            $locale ?? "en",
            t,
        ),
    );
    const faces = $derived(
        members.slice(0, 5).map((m) => ({
            src: m.blobUrl,
            grad: AVATAR_GRADIENTS[senderColor(m.userId)],
        })),
    );

    const rules = $derived(
        chatRulesText(client, chat, $selectedChatRulesStore, $selectedCommunityRulesStore),
    );

    // ---- leaving and deleting: each with Undo, as the conversation's menu

    const canLeave = $derived(
        chatMenuActions(chat, {
            canLeave: client.canLeaveGroup(chat.id),
            blocked: false,
            isBot: false,
        }).includes("leave"),
    );

    // back to the list, where the chat has gone, with Undo
    function leave() {
        navigate(routeForScope($chatListScopeStore), "dismiss");
        removeWithUndo(
            client,
            context,
            chatIdentifierToString(chat.id),
            { kind: "leave", chatId: chat.id },
            $_("native.chats.toast.left", { values: { name: chat.name } }),
        );
    }

    // back to the list, where the chat has gone, with Undo: the delete is sent once the toast has
    // gone (the shell's PendingRemovals), and Undo sends nothing
    function deleteChat() {
        navigate(routeForScope($chatListScopeStore), "dismiss");
        removeWithUndo(
            client,
            context,
            chatIdentifierToString(chat.id),
            { kind: "delete", chatId: chat.id },
            $_("native.details.deleted", { values: { name: chat.name } }),
        );
    }

    // ---- the cover's kebab: Edit group (N7's page), Copy invite link

    // the link, for a member who may share it: a public chat's is there at once; a private
    // group's is loaded (its code), for someone who may invite, and offered only while it's on.
    // The screen is this chat's for its life
    const sharing = untrack(() =>
        member && (chat.public || permissions.canInvite) ? new MemberManagement(client, chat) : undefined,
    );
    onMount(() => {
        void sharing?.initialiseSharing();
    });
    const inviteLink = $derived(sharing?.sharingLink);

    const menuItems = $derived<NativeMenuItem[]>([
        ...(permissions.canEdit
            ? [
                  {
                      id: "edit",
                      label: $_(channel ? "native.details.menu.editChannel" : "native.details.menu.editGroup"),
                      icon: "edit",
                  },
              ]
            : []),
        ...(inviteLink !== undefined
            ? [{ id: "copy_link", label: $_("native.details.menu.copyInviteLink"), icon: "link" }]
            : []),
    ]);
    let menuAnchor = $state<HTMLElement | null>(null);
    useOverlay(
        overlays,
        () => menuAnchor !== null,
        () => (menuAnchor = null),
    );

    async function onMenu(id: string) {
        if (id === "edit") {
            context.push({ kind: "group_settings", chatId: chat.id, page: "edit" });
        } else if (id === "copy_link" && inviteLink !== undefined) {
            if (await copyText(inviteLink)) context.toast($_("linkCopiedToClipboard"));
        }
    }

    // ---- the tiles and toggles

    function onTile(id: DetailTileId) {
        switch (id) {
            case "mute":
                void muteWithToast(
                    client,
                    context,
                    chat.id,
                    !muted,
                    $_(muted ? "native.chats.toast.unmuted" : "native.chats.toast.muted"),
                    $_,
                );
                return;
            case "search":
                // back to the conversation, which opens its search
                context.back?.();
                requestSearch(chatIdentifierToString(chat.id));
                return;
            case "invite":
                openInvite(client, chat, community, $anonUserStore, context, $_);
                return;
        }
    }

    function toggleFavourite() {
        void favouriteWithToast(
            client,
            context,
            chat.id,
            !favourite,
            $_(favourite ? "native.chats.toast.unfavourited" : "native.chats.toast.favourited"),
        );
    }

    async function muteEveryone(on: boolean) {
        const failed = await muteChat(client, chat.id, undefined, on, $_);
        if (failed !== undefined) toastStore.showFailureToast(failed);
    }

    // ---- disappearing messages: switched and set by those its settings let change them (as the
    // conversation's menu offers them), read only otherwise

    const canSetDisappearing = $derived(
        canChangeDisappearing(client, chat, community, $anonUserStore),
    );
</script>

<div class="scroll">
    <DetailsHead
        title={chat.name}
        {sub}
        coverUrl={community?.banner.blobUrl}
        photoUrl={chat.blobUrl}
        color={senderColor(chatIdentifierToString(chat.id))}
        square
        {favourite}
        onBack={context.back}
        onFavourite={toggleFavourite}
        onMore={menuItems.length > 0 ? (anchor) => (menuAnchor = anchor) : undefined} />

    <div class="content">
        <DetailTiles {tiles} {onTile} />

        <SettingsGroup label={$_("native.you.about")}>
            {#if description !== ""}
                <TextRow text={description} />
            {/if}
            {#each createdRows as fact (fact.label)}
                <FactRow label={fact.label} value={fact.value} />
            {/each}
            <FactRow label={$_("native.details.history")} value={historyValue(chat.historyVisible, t)} />
        </SettingsGroup>

        <SettingsGroup label={$_("members")}>
            <button
                type="button"
                class="settings-row members-row"
                onclick={() => context.push({ kind: "chat_members", chatId: chat.id })}>
                <AvatarStack people={faces} max={5} size={30} ring="var(--surface-0)" />
                <span class="view-all">
                    {$_("native.details.viewAll", { values: { count: chat.memberCount } })}
                </span>
                <span class="chevron"></span>
            </button>
        </SettingsGroup>

        {#if member}
            <SettingsGroup label={$_("native.details.thisChat")}>
                {#if canSetDisappearing}
                    <DisappearingRow {chat} {context} />
                {:else}
                    <FactRow
                        label={$_("native.details.disappearing")}
                        value={disappearingValue(chat.eventsTTL, t)} />
                {/if}
                <SettingsSwitch
                    label={$_("native.details.muteEveryone")}
                    help={$_("native.details.muteEveryoneHelp")}
                    on={chat.membership.atEveryoneMuted}
                    onChange={muteEveryone} />
            </SettingsGroup>
        {/if}

        {#if rules !== ""}
            <SettingsGroup label={$_("native.details.rules")}>
                <TextRow text={rules} />
            </SettingsGroup>
        {/if}

        {#if showsManage(chat.membership.role, frozen)}
            <SettingsGroup label={$_("native.details.manage.title")}>
                {#each manageRows(t) as row (row.page)}
                    <SettingsLink
                        icon={row.icon}
                        label={row.label}
                        onClick={() =>
                            context.push({ kind: "group_settings", chatId: chat.id, page: row.page })} />
                {/each}
            </SettingsGroup>
        {/if}

        {#if canLeave || permissions.canDelete}
            <SettingsGroup>
                {#if canLeave}
                    <SettingsAction
                        icon="exit"
                        label={$_(
                            channel
                                ? "native.conversation.menu.leaveChannel"
                                : "native.conversation.menu.leaveGroup",
                        )}
                        danger
                        onClick={leave} />
                {/if}
                {#if permissions.canDelete}
                    <SettingsAction
                        icon="trash"
                        label={$_(
                            channel ? "native.details.deleteChannel" : "native.details.deleteGroup",
                        )}
                        danger
                        onClick={deleteChat} />
                {/if}
            </SettingsGroup>
        {/if}
    </div>
</div>

<AnchoredMenu
    anchor={menuAnchor}
    items={menuItems}
    label={$_("native.conversation.options")}
    onSelect={(id) => void onMenu(id)}
    onClose={() => (menuAnchor = null)} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

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

    .members-row {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
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

    .view-all {
        flex: 1;
        min-width: 0;
        text-align: end;
        font: var(--weight-semibold) text-size(13.5px) / 1.2 var(--font-sans);
        color: var(--accent-bright);
        @include truncate;
    }

    .chevron {
        @include icon(chevron-right, 14px, var(--ink-4));

        &:dir(rtl) {
            transform: scaleX(-1);
        }
    }
</style>

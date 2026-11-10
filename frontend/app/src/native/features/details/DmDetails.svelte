<!-- A DM's details (native plan 10, Design Notes §3.6): the cover with back, favourite and the kebab
     (Delete chat, the one thing the conversation's menu has that isn't here already); the other
     person's avatar, name and @username; the tiles Call / Search / Mute; About (their bio, member
     since, the CHIT they've earned); This chat (disappearing messages: a switch and, while it's on,
     how long; the plan's read receipts aren't a setting the app has); Block. Their profile is
     loaded as it opens (logic/profile's ProfileCardData, the web's user card's); About shows once
     it's in. -->
<script lang="ts">
    import {
        allUsersStore,
        blockedUsersStore,
        buildUserBackgroundUrl,
        chatIdentifierToString,
        chatListScopeStore,
        favouritesStore,
        routeForScope,
        toMonthYearString,
        userBadges,
        type DirectChatSummary,
        type OpenChat,
    } from "@client";
    import { Optimistic } from "@openchat/ui/src/lib/behaviours/optimistic.svelte";
    import AnchoredMenu from "@openchat/ui/src/native/AnchoredMenu.svelte";
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsSwitch from "@openchat/ui/src/native/SettingsSwitch.svelte";
    import SettingsValue from "@openchat/ui/src/native/SettingsValue.svelte";
    import { chatMenuActions } from "@src/logic/chats/chatMenu";
    import {
        disappearingChoices,
        durationIdMs,
        ttlDurationId,
    } from "@src/logic/chats/disappearingMessages";
    import { setDmDisappearing } from "@src/logic/chats/dmSettings";
    import { senderColor } from "@src/logic/conversation/messageRow";
    import { ProfileCardData } from "@src/logic/profile/profileCardData.svelte";
    import { disableChit } from "@src/stores/settings";
    import { navigate } from "@src/utils/navigation";
    import { blobUrlPattern } from "@src/utils/openchatClient";
    import { getContext, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenContext } from "../app/screens";
    import { blockWithToast, favouriteWithToast, muteWithToast } from "../chats/chatToasts";
    import { removeWithUndo } from "../chats/removeWithUndo";
    import { requestSearch } from "../conversation/searchRequests";
    import DetailsHead from "./DetailsHead.svelte";
    import DetailTiles from "./DetailTiles.svelte";
    import FactRow from "./FactRow.svelte";
    import TextRow from "./TextRow.svelte";
    import { dmTiles, durationLabel, type DetailTileId } from "./details.adapter";

    let { chat, context }: { chat: DirectChatSummary; context: ScreenContext } = $props();

    const client = getContext<OpenChat>("client");
    const overlays = untrack(() => context.overlays);
    // the screen is this DM's for its life
    const userId = untrack(() => chat.them.userId);
    // their profile; a bot has none, so About doesn't show for one
    const card = new ProfileCardData(client, userId, () => undefined);

    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });

    const them = $derived($allUsersStore.get(userId));
    const isBot = $derived(them?.kind === "bot");
    const title = $derived(client.displayName(them));
    // the user as their @username, else their name
    const name = $derived(them?.username ? `@${them.username}` : title);
    const coverUrl = $derived(
        buildUserBackgroundUrl(blobUrlPattern, userId, card.profile?.backgroundId),
    );
    const favourite = $derived($favouritesStore.has(chat.id));
    const muted = $derived(chat.membership.notificationsMuted);
    const blocked = $derived($blockedUsersStore.has(userId));

    const tiles = $derived(
        dmTiles(
            {
                canCall: !client.isChatReadOnly(chat.id) && client.canStartVideoCalls(chat.id),
                muted,
                isBot,
            },
            t,
        ),
    );

    // ---- About

    const bio = $derived(card.profile?.bio ?? "");
    const memberSince = $derived(
        card.profile !== undefined && card.profile.created > 0n
            ? toMonthYearString(new Date(Number(card.profile.created)), $locale ?? "en")
            : "",
    );
    const chit = $derived(
        card.user === undefined
            ? undefined
            : userBadges(
                  {
                      diamondStatus: card.user.diamondStatus,
                      streak: card.user.streak,
                      chitEarned: card.user.totalChitEarned,
                  },
                  $disableChit,
              ).chit,
    );

    // ---- the cover's kebab: Delete chat

    const canDelete = $derived(
        chatMenuActions(chat, { canLeave: false, blocked, isBot }).includes("delete"),
    );
    let menuAnchor = $state<HTMLElement | null>(null);
    useOverlay(
        overlays,
        () => menuAnchor !== null,
        () => (menuAnchor = null),
    );

    // back to the list, where the chat has gone, with Undo (as the conversation's menu does)
    function deleteChat() {
        navigate(routeForScope($chatListScopeStore), "dismiss");
        removeWithUndo(
            client,
            context,
            chatIdentifierToString(chat.id),
            { kind: "delete_direct_chat", chatId: chat.id, blockUser: false },
            $_("native.chats.toast.deleted"),
        );
    }

    // ---- the tiles

    function onTile(id: DetailTileId) {
        switch (id) {
            case "call":
                // calls are N14's, as the conversation's header buttons
                context.toast($_("native.conversation.callsLater"));
                return;
            case "search":
                // back to the conversation, which opens its search
                context.back?.();
                requestSearch(chatIdentifierToString(chat.id));
                return;
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

    // ---- disappearing messages: shown at once, back as it was (with a toast) if it's refused

    const disappear = new Optimistic(() => ({
        on: chat.eventsTTL !== undefined,
        after: ttlDurationId(chat.eventsTTL),
    }));
    $effect.pre(() => {
        void chat.eventsTTL;
        untrack(() => disappear.sync());
    });
    const durations = $derived(
        disappearingChoices(chat.eventsTTL).map((id) => ({ id, label: durationLabel(id, t) })),
    );

    async function setDisappearing(on: boolean, after: string) {
        const saved = await disappear.set({ on, after }, () =>
            setDmDisappearing(client, chat, { on, afterMs: durationIdMs(after) }),
        );
        if (!saved) context.toast($_("native.details.saveFailed"));
    }

    // ---- block: with Undo, as the conversation's menu

    function block(blocking: boolean) {
        const words = (key: string) => $_(`native.conversation.toast.${key}`, { values: { name } });
        void blockWithToast(
            (id, value) => client.setBlockedInDirectChat(id, value),
            context,
            userId,
            blocking,
            {
                blocking: words("blocking"),
                blocked: words("blocked"),
                unblocking: words("unblocking"),
                unblocked: words("unblocked"),
            },
        );
    }
</script>

<div class="scroll">
    <DetailsHead
        {title}
        sub={them?.username ? `@${them.username}` : ""}
        {coverUrl}
        photoUrl={them?.blobUrl}
        color={senderColor(userId)}
        square={false}
        {favourite}
        onBack={context.back}
        onFavourite={toggleFavourite}
        onMore={canDelete ? (anchor) => (menuAnchor = anchor) : undefined} />

    <div class="content">
        <DetailTiles {tiles} {onTile} />

        {#if card.profile !== undefined}
            <SettingsGroup label={$_("native.you.about")}>
                {#if bio !== ""}
                    <TextRow text={bio} />
                {/if}
                {#if memberSince !== ""}
                    <FactRow label={$_("native.you.memberSince")} value={memberSince} />
                {/if}
                {#if chit !== undefined}
                    <FactRow
                        label={$_("native.details.chitEarned")}
                        value={chit.earned.toLocaleString($locale ?? "en")}
                        mono />
                {/if}
            </SettingsGroup>
        {/if}

        <SettingsGroup label={$_("native.details.thisChat")}>
            <SettingsSwitch
                label={$_("native.details.disappearing")}
                help={$_("native.details.disappearingHelp")}
                on={disappear.current.on}
                onChange={(on) => setDisappearing(on, disappear.current.after)} />
            {#if disappear.current.on}
                <SettingsValue
                    label={$_("native.details.disappearAfterLabel")}
                    options={durations}
                    value={disappear.current.after}
                    onChange={(after) => setDisappearing(true, after)} />
            {/if}
        </SettingsGroup>

        {#if !isBot}
            <SettingsGroup>
                {#if blocked}
                    <SettingsAction
                        icon="ban"
                        label={$_("native.details.unblock", { values: { name } })}
                        onClick={() => block(false)} />
                {:else}
                    <SettingsAction
                        icon="ban"
                        label={$_("native.conversation.menu.block", { values: { name } })}
                        danger
                        onClick={() => block(true)} />
                {/if}
            </SettingsGroup>
        {/if}
    </div>
</div>

<AnchoredMenu
    anchor={menuAnchor}
    items={[
        {
            id: "delete",
            label: $_("native.conversation.menu.delete"),
            icon: "trash",
            danger: true,
        },
    ]}
    label={$_("native.conversation.options")}
    onSelect={deleteChat}
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
</style>

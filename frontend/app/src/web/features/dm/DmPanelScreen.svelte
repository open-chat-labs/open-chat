<!-- The right column's panel for a DM: the other person (avatar, name, bio, when they joined, their
     CHIT), mute, favourite, disappearing messages and block. Changes apply at once, and DmPanel
     rolls a field back with its own error when the change fails. -->
<script lang="ts">
    import {
        allUsersStore,
        blockedUsersStore,
        buildUserAvatarUrl,
        eventsTTLUpdate,
        favouritesStore,
        lastOnlineStatus,
        OpenChat,
        selectedChatSummaryStore,
        userBadges,
        type DirectChatSummary,
    } from "@client";
    import type { DisappearSetting } from "@openchat/ui/src/features/components/DmChatSettings.svelte";
    import DmPanel from "@openchat/ui/src/features/components/DmPanel.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import { muteChat } from "@src/logic/chats/muteChat";
    import { ProfileCardData } from "@src/logic/profile/profileCardData.svelte";
    import { disableChit } from "@src/stores/settings";
    import { blobUrlPattern } from "@src/utils/openchatClient";
    import { profileClickedEvent } from "@src/web-components/profileLink";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { closeRightColumn } from "../app/rightPanel";
    import type { RightRegion, ScreenProps } from "../app/screens";
    import { dmPanelProps } from "./dm.adapter";

    let {
        region,
        context,
    }: ScreenProps<Extract<RightRegion, { kind: "direct_chat_details" }>> = $props();

    const client = getContext<OpenChat>("client");

    const chat = $derived<DirectChatSummary | undefined>(
        $selectedChatSummaryStore?.kind === "direct_chat" ? $selectedChatSummaryStore : undefined,
    );
    const userId = $derived(chat?.them.userId);

    // loaded once per person, not on every change to the chat's summary
    const card = $derived.by(() => {
        const id = userId;
        return id === undefined
            ? undefined
            : untrack(() => new ProfileCardData(client, id, () => undefined));
    });

    const panel = $derived.by(() => {
        if (chat === undefined || userId === undefined || card === undefined) return undefined;
        const { user, profile } = card;
        if (user === undefined || profile === undefined) return undefined;
        $allUsersStore.get(userId);
        return dmPanelProps({
            name: client.getDisplayName(userId),
            profile,
            avatarUrl: buildUserAvatarUrl(blobUrlPattern, userId, profile.avatarId),
            online: lastOnlineStatus($_, Date.now(), card.lastOnline)[1],
            joined: client.toMonthYearString(new Date(Number(profile.created))),
            chit: userBadges(
                {
                    diamondStatus: user.diamondStatus,
                    streak: user.streak,
                    chitEarned: user.totalChitEarned,
                },
                $disableChit,
            ).chit,
            eventsTTL: chat.eventsTTL,
            muted: chat.membership.notificationsMuted,
            favourite: $favouritesStore.has(chat.id),
            blocked: $blockedUsersStore.has(userId),
        });
    });

    // DmPanel shows its own error and rolls back when one of these rejects
    function succeeded(success: boolean) {
        if (!success) throw new Error("not saved");
    }

    async function mute(key: string | null) {
        if (chat === undefined) return;
        const failed = await muteChat(client, chat.id, key !== null, undefined, $_);
        succeeded(failed === undefined);
    }

    async function favourite(fav: boolean) {
        if (chat === undefined) return;
        succeeded(
            await (fav ? client.addToFavourites(chat.id) : client.removeFromFavourites(chat.id)),
        );
    }

    async function disappear(setting: DisappearSetting) {
        if (chat === undefined) return;
        const next = setting.on ? BigInt(setting.afterMs) : undefined;
        succeeded(
            await client.updateDirectChatSettings(chat, eventsTTLUpdate(next, chat.eventsTTL)),
        );
    }

    async function block(blocking: boolean) {
        if (userId === undefined) return;
        succeeded(
            await (blocking
                ? client.blockUserInContext({ kind: "direct_chat" }, userId)
                : client.unblockUserInContext({ kind: "direct_chat" }, userId)),
        );
    }

    function close() {
        if (region.back) {
            client.popRightPanelHistory();
        } else {
            closeRightColumn(context.rightColumn);
        }
    }
</script>

{#if panel !== undefined && userId !== undefined}
    <!-- OpenChat has no read receipts setting, so the panel gets no handler and hides the row (GAPS.md) -->
    <DmPanel
        {...panel}
        coverHandlers={{ close }}
        onMuteChange={mute}
        onToggleFavourite={favourite}
        onDisappearChange={disappear}
        onOpenProfile={() => document.body.dispatchEvent(profileClickedEvent(userId))}
        onBlock={() => block(true)}
        onUnblock={() => block(false)}>
        {#snippet aboutContent()}
            <Markdown inline={false} text={panel.about} />
        {/snippet}
    </DmPanel>
{/if}

<!-- Someone's profile card, opened by a name clicked in a message (`<profile-link>`): their name,
     avatar, cover, bio, when they joined and their CHIT, with Block / Unblock where the card was
     opened, the Chat button, and suspend / unsuspend for platform moderators. Opened from your DM
     with them (`dmTab`), it has Profile / This chat tabs with the DM's mute, favourite and
     disappearing messages, as the design's DM profile. -->
<script lang="ts">
    import {
        buildUserAvatarUrl,
        buildUserBackgroundUrl,
        lastOnlineStatus,
        currentUserIdStore,
        favouritesStore,
        OpenChat,
        selectedChatSummaryStore,
        platformModeratorStore,
        publish,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
        unsuspendUserMessage,
        userBadges,
    } from "@client";
    import UserDialog from "@openchat/ui/src/features/components/UserDialog.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import { profileCardChat } from "@src/logic/profile/profileCard";
    import { ProfileCardBlock, ProfileCardData } from "@src/logic/profile/profileCardData.svelte";
    import { disableChit } from "@src/stores/settings";
    import { toastStore } from "@src/stores/toast";
    import { blobUrlPattern } from "@src/utils/openchatClient";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { ttlDurationId } from "@src/logic/chats/disappearingMessages";
    import { favouriteDm, muteDm, setDmDisappearing } from "../dm/dmSettings";
    import { userDialogProps } from "./user.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "user" }>> = $props();

    const client = getContext<OpenChat>("client");
    // the card's user is fixed for its life: another name opens another card
    const userId = dialog.userId;
    const card = new ProfileCardData(client, userId, onClose);

    const online = $derived(lastOnlineStatus($_, Date.now(), card.lastOnline)[1]);

    const isMe = $derived(userId === $currentUserIdStore);

    // their name where the card was opened: a community display name in a community
    const name = $derived(
        client.getDisplayName(
            userId,
            dialog.inGlobalContext ? undefined : $selectedCommunityMembersStore,
            dialog.inGlobalContext ? undefined : $selectedChatWebhooksStore,
        ),
    );

    const userProps = $derived.by(() => {
        const { user, profile } = card;
        if (user === undefined || profile === undefined) return undefined;
        const badges = userBadges(
            {
                diamondStatus: user.diamondStatus,
                streak: user.streak,
                chitEarned: user.totalChitEarned,
            },
            $disableChit,
        );
        return userDialogProps({
            name,
            profile,
            avatarUrl: buildUserAvatarUrl(blobUrlPattern, userId, profile.avatarId),
            coverUrl: buildUserBackgroundUrl(blobUrlPattern, userId, profile.backgroundId),
            online,
            joined: client.toMonthYearString(new Date(Number(profile.created))),
            chit: badges.chit,
        });
    });

    // the DM it was opened from, while it's still the open chat
    const dm = $derived(
        dialog.dmTab !== undefined &&
            $selectedChatSummaryStore?.kind === "direct_chat" &&
            $selectedChatSummaryStore.them.userId === userId
            ? $selectedChatSummaryStore
            : undefined,
    );

    const cardBlock = new ProfileCardBlock(client, userId, dialog.inGlobalContext);
    const block = $derived(cardBlock.current);

    // UserDialog shows its own error when the promise rejects
    async function blockUser() {
        if (block.kind !== "block" || !(await client.blockUserInContext(block.context, userId))) {
            throw new Error("block failed");
        }
    }

    async function unblockUser() {
        if (
            block.kind !== "unblock" ||
            !(await client.unblockUserInContext(block.context, userId))
        ) {
            throw new Error("unblock failed");
        }
    }

    function chat() {
        onClose();
        publish("chatWith", profileCardChat(dialog));
    }

    async function unsuspend() {
        const success = await client.unsuspendUser(userId);
        const message = unsuspendUserMessage(success);
        if (success) {
            toastStore.showSuccessToast(message);
        } else {
            toastStore.showFailureToast(message);
        }
    }

    // TODO(design): the design has no place for a moderator's suspend / unsuspend
    const moderatorAction = $derived(
        !$platformModeratorStore || card.user === undefined
            ? undefined
            : card.user.suspended
              ? { label: $_("unsuspendUser"), onAction: unsuspend }
              : { label: $_("suspendUser"), onAction: () => publish("suspendUser", userId) },
    );
</script>

{#if userProps !== undefined}
    <UserDialog
        {...userProps}
        isSelf={isMe}
        blocked={block.kind === "unblock"}
        onBlock={block.kind === "block" ? blockUser : undefined}
        onUnblock={block.kind === "unblock" ? unblockUser : undefined}
        onMessage={dialog.chatButton && !isMe ? chat : undefined}
        {moderatorAction}
        dmTabs={dm !== undefined}
        initialTab={dialog.dmTab}
        muted={dm?.membership.notificationsMuted ? "always" : null}
        fav={dm !== undefined && $favouritesStore.has(dm.id)}
        disappearOn={dm?.eventsTTL !== undefined}
        disappearAfter={ttlDurationId(dm?.eventsTTL)}
        onMuteChange={dm && ((key) => dm && muteDm(client, dm, key !== null, $_))}
        onToggleFavourite={dm && ((fav) => dm && favouriteDm(client, dm, fav))}
        onDisappearChange={dm && ((setting) => dm && setDmDisappearing(client, dm, setting))}
        onCancel={onClose}
    >
        {#snippet aboutContent()}
            <Markdown inline={false} text={userProps.about} />
        {/snippet}
    </UserDialog>
{/if}

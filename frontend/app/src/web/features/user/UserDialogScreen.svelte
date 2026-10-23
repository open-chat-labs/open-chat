<!-- Someone's profile card, opened by a name clicked in a message (`<profile-link>`): their name,
     avatar, cover, bio, when they joined and their CHIT, with Block / Unblock where the card was
     opened, the Chat button, and suspend / unsuspend for platform moderators. -->
<script lang="ts">
    import {
        blockedUsersStore,
        buildUserAvatarUrl,
        buildUserBackgroundUrl,
        currentUserIdStore,
        OpenChat,
        platformModeratorStore,
        profileBlock,
        publish,
        selectedChatBlockedUsersStore,
        selectedChatSummaryStore,
        selectedChatWebhooksStore,
        selectedCommunityBlockedUsersStore,
        selectedCommunityMembersStore,
        selectedCommunitySummaryStore,
        unsuspendUserMessage,
        userBadges,
    } from "@client";
    import UserDialog from "@openchat/ui/src/features/components/UserDialog.svelte";
    import { profileCardChat } from "@src/logic/profile/profileCard";
    import { ProfileCardData } from "@src/logic/profile/profileCardData.svelte";
    import { disableChit } from "@src/stores/settings";
    import { toastStore } from "@src/stores/toast";
    import { blobUrlPattern } from "@src/utils/openchatClient";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { userDialogProps } from "./user.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "user" }>> = $props();

    const client = getContext<OpenChat>("client");
    // the card's user is fixed for its life: another name opens another card
    const userId = dialog.userId;
    const card = new ProfileCardData(client, userId, onClose);

    // when they were last online, as the old card loads it; until then (or if it fails) not online
    let lastOnline = $state<number>();
    $effect(() => {
        let live = true;
        (async () => {
            try {
                const at = await client.getLastOnlineDate(userId, Date.now());
                if (live) lastOnline = at;
            } catch (e) {
                console.log("Failed to load when the user was last online", e);
            }
        })();
        return () => (live = false);
    });
    const online = $derived(
        lastOnline !== undefined &&
            lastOnline !== 0 &&
            client.formatLastOnlineDate($_, Date.now(), lastOnline)[1],
    );

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
            joined: client.toDateString(new Date(Number(profile.created))),
            chitEarned: badges.chit?.earned.toLocaleString(),
        });
    });

    const block = $derived(
        profileBlock({
            userId,
            isMe,
            inGlobalContext: dialog.inGlobalContext,
            chat: $selectedChatSummaryStore,
            community: $selectedCommunitySummaryStore,
            blockedUsers: $blockedUsersStore,
            blockedChatUsers: $selectedChatBlockedUsersStore,
            blockedCommunityUsers: $selectedCommunityBlockedUsersStore,
            canBlockUsers: (id) => client.canBlockUsers(id),
        }),
    );

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
        onCancel={onClose} />
{/if}

<script lang="ts">
    import {
        type ChatSummary,
        type CommunitySummary,
        type OpenChat,
        type PublicProfile,
        type ReadonlySet,
        type ResourceKey,
        type UserSummary,
        blockedUsersStore,
        currentUserIdStore,
        mobileWidth,
        platformModeratorStore,
        publish,
        selectedChatBlockedUsersStore,
        selectedChatSummaryStore,
        selectedCommunityBlockedUsersStore,
        selectedCommunitySummaryStore,
    } from "openchat-client";

    import { CommonButton, Container, Sheet } from "component-lib";
    import page from "page";
    import { getContext, onMount } from "svelte";
    import AccountCancel from "svelte-material-icons/AccountCancelOutline.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import ChatOutline from "svelte-material-icons/ChatOutline.svelte";
    import Cog from "svelte-material-icons/Cog.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Translatable from "../../Translatable.svelte";
    import UserProfileSummaryCard from "../user_profile/UserProfileSummaryCard.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        userId: string;
        chatButton?: boolean;
        inGlobalContext?: boolean;
        onOpenDirectChat: () => void;
        onClose: () => void;
    }

    let {
        userId,
        chatButton = true,
        inGlobalContext = false,
        onOpenDirectChat,
        onClose,
    }: Props = $props();

    let profile: PublicProfile | undefined = $state();
    let user: UserSummary | undefined = $state();
    let rendering = $state<Promise<void>>();

    onMount(async () => {
        try {
            rendering = new Promise(async (resolve) => {
                user = await client.getUser(userId);
                client.getPublicProfile(userId).subscribe({
                    onResult: (result) => {
                        profile = result;
                        if (profile === undefined) {
                            onClose();
                        } else {
                            resolve();
                        }
                    },
                });
            });
        } catch (e: any) {
            client.logError("Failed to load user profile", e);
            onClose();
        }
    });

    function afterBlock(result: boolean, success: ResourceKey, failure: ResourceKey) {
        if (!result) {
            toastStore.showFailureToast(failure);
        } else {
            toastStore.showSuccessToast(success);
        }
    }

    function blockUser() {
        if ($selectedChatSummaryStore !== undefined) {
            if ($selectedChatSummaryStore.kind === "direct_chat") {
                client.blockUserFromDirectChat(userId).then((success) => {
                    afterBlock(success, i18nKey("blockUserSucceeded"), i18nKey("blockUserFailed"));
                });
                onClose();
                return;
            }
            if ($selectedChatSummaryStore.kind === "group_chat") {
                client.blockUser($selectedChatSummaryStore.id, userId).then((success) => {
                    afterBlock(success, i18nKey("blockUserSucceeded"), i18nKey("blockUserFailed"));
                });
                onClose();
                return;
            }
        }
        if ($selectedCommunitySummaryStore !== undefined) {
            client
                .blockCommunityUser($selectedCommunitySummaryStore.id, userId)
                .then((success) =>
                    afterBlock(success, i18nKey("blockUserSucceeded"), i18nKey("blockUserFailed")),
                );
            onClose();
            return;
        }
    }

    function unblockUser() {
        if ($selectedChatSummaryStore !== undefined) {
            if ($selectedChatSummaryStore.kind === "direct_chat") {
                client.unblockUserFromDirectChat(userId).then((success) => {
                    afterBlock(
                        success,
                        i18nKey("unblockUserSucceeded"),
                        i18nKey("unblockUserFailed"),
                    );
                });
                onClose();
                return;
            }
            if ($selectedChatSummaryStore.kind === "group_chat") {
                client.unblockUser($selectedChatSummaryStore.id, userId).then((success) => {
                    afterBlock(
                        success,
                        i18nKey("unblockUserSucceeded"),
                        i18nKey("unblockUserFailed"),
                    );
                });
                onClose();
                return;
            }
        }
        if ($selectedCommunitySummaryStore !== undefined) {
            client
                .unblockCommunityUser($selectedCommunitySummaryStore.id, userId)
                .then((success) =>
                    afterBlock(
                        success,
                        i18nKey("unblockUserSucceeded"),
                        i18nKey("unblockUserFailed"),
                    ),
                );
            onClose();
            return;
        }
    }

    function canBlockUser(
        chat: ChatSummary | undefined,
        community: CommunitySummary | undefined,
        blockedUsers: ReadonlySet<string>,
        blockedChatUsers: ReadonlySet<string>,
        blockedCommunityUsers: ReadonlySet<string>,
    ) {
        if (me || inGlobalContext) return false;

        if (chat !== undefined) {
            if (chat.kind === "direct_chat") return !blockedUsers.has(userId);
            if (chat.kind === "group_chat")
                return !blockedChatUsers.has(userId) && client.canBlockUsers(chat.id);
        }
        if (community !== undefined) {
            return !blockedCommunityUsers.has(userId) && client.canBlockUsers(community.id);
        }
        return false;
    }

    function canUnblockUser(
        chat: ChatSummary | undefined,
        community: CommunitySummary | undefined,
        blockedUsers: ReadonlySet<string>,
        blockedChatUsers: ReadonlySet<string>,
        blockedCommunityUsers: ReadonlySet<string>,
    ) {
        if (me || inGlobalContext) return false;
        if (chat !== undefined) {
            if (chat.kind === "direct_chat") return blockedUsers.has(userId);
            if (chat.kind === "group_chat")
                return blockedChatUsers.has(userId) && client.canBlockUsers(chat.id);
        }
        if (community !== undefined) {
            return blockedCommunityUsers.has(userId) && client.canBlockUsers(community.id);
        }
        return false;
    }

    function handleOpenDirectChat() {
        onOpenDirectChat();
    }

    function showUserProfile() {
        page("/profile_summary");
        onClose();
    }

    function onWindowResize() {
        if (!modal) {
            onClose();
        }
    }

    function unsuspendUser() {
        client.unsuspendUser(userId).then((success) => {
            if (success) {
                toastStore.showSuccessToast(i18nKey("unsuspendedUser"));
                onClose();
            } else {
                toastStore.showFailureToast(i18nKey("failedToUnsuspendUser"));
            }
        });
    }

    function suspendUser() {
        publish("suspendUser", userId);
        onClose();
    }
    let me = $derived(userId === $currentUserIdStore);
    let isSuspended = $derived(user?.suspended ?? false);
    let modal = $derived($mobileWidth);
    let canBlock = $derived(
        canBlockUser(
            $selectedChatSummaryStore,
            $selectedCommunitySummaryStore,
            $blockedUsersStore,
            $selectedChatBlockedUsersStore,
            $selectedCommunityBlockedUsersStore,
        ),
    );
    let canUnblock = $derived(
        canUnblockUser(
            $selectedChatSummaryStore,
            $selectedCommunitySummaryStore,
            $blockedUsersStore,
            $selectedChatBlockedUsersStore,
            $selectedCommunityBlockedUsersStore,
        ),
    );
</script>

<svelte:window onresize={onWindowResize} />

{#if profile !== undefined}
    <Sheet {onClose}>
        {#if profile !== undefined && user !== undefined}
            <!-- <UserProfileCard {user} {profile} {inGlobalContext} {onClose}></UserProfileCard> -->
            <Container direction={"vertical"} padding={["sm", "sm", "lg", "sm"]}>
                <UserProfileSummaryCard mode={"view"} {user} {profile}></UserProfileSummaryCard>
                <Container mainAxisAlignment={"center"} gap={"xs"}>
                    {#if chatButton && !me}
                        <CommonButton onClick={handleOpenDirectChat} mode={"active"}>
                            {#snippet icon(color)}
                                <ChatOutline {color} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey("profile.chat")} />
                        </CommonButton>
                    {/if}
                    {#if me}
                        <CommonButton onClick={showUserProfile} mode={"active"}>
                            {#snippet icon(color)}
                                <Cog {color} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey("profile.label")} />
                        </CommonButton>
                    {/if}
                    {#if canBlock}
                        <CommonButton onClick={blockUser} mode={"active"}>
                            {#snippet icon(color)}
                                <Cancel {color} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey("profile.block")} />
                        </CommonButton>
                    {/if}
                    {#if canUnblock}
                        <CommonButton onClick={unblockUser} mode={"active"}>
                            {#snippet icon(color)}
                                <Cancel {color} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey("profile.unblock")} />
                        </CommonButton>
                    {/if}
                    {#if $platformModeratorStore}
                        {#if isSuspended}
                            <CommonButton onClick={unsuspendUser} mode={"active"}>
                                {#snippet icon(color)}
                                    <AccountCancel {color} />
                                {/snippet}
                                <Translatable resourceKey={i18nKey("unsuspendUser")} />
                            </CommonButton>
                        {:else}
                            <CommonButton onClick={suspendUser} mode={"active"}>
                                {#snippet icon(color)}
                                    <AccountCancel {color} />
                                {/snippet}
                                <Translatable resourceKey={i18nKey("suspendUser")} />
                            </CommonButton>
                        {/if}
                    {/if}
                </Container>
            </Container>
        {/if}
    </Sheet>
{/if}

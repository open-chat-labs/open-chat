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
        setRightPanelHistory,
    } from "openchat-client";

    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
    import UserProfileCard from "./UserProfileCard.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        userId: string;
        alignTo?: DOMRect | undefined;
        chatButton?: boolean;
        inGlobalContext?: boolean;
        onOpenDirectChat: () => void;
        onClose: () => void;
    }

    let {
        userId,
        alignTo = undefined,
        chatButton = true,
        inGlobalContext = false,
        onOpenDirectChat,
        onClose,
    }: Props = $props();

    let profile: PublicProfile | undefined = $state();
    let user: UserSummary | undefined = $state();
    let backgroundUrl = $derived(
        profile !== undefined
            ? client.buildUserBackgroundUrl(
                  import.meta.env.OC_BLOB_URL_PATTERN!,
                  userId,
                  profile.backgroundId,
              )
            : undefined,
    );
    let hasCustomBackground = $derived(backgroundUrl !== undefined);

    onMount(async () => {
        try {
            const task1 = client.getPublicProfile(userId);
            const task2 = client.getUser(userId);
            user = await task2;
            profile = await task1;
            if (profile === undefined) {
                onClose();
            }
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
        setRightPanelHistory([{ kind: "user_profile" }]);
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
    <Overlay dismissible {onClose}>
        <ModalContent
            fill
            compactFooter
            backgroundImage={backgroundUrl}
            hideFooter={!me && !chatButton && !canBlock && !canUnblock}
            hideHeader
            fixedWidth={false}
            large={modal}
            footerClass={hasCustomBackground ? "mask-footer" : ""}
            {alignTo}
            {onClose}>
            {#snippet body()}
                {#if profile !== undefined && user !== undefined}
                    <UserProfileCard {user} {profile} {inGlobalContext} {onClose}></UserProfileCard>
                {/if}
            {/snippet}
            {#snippet footer()}
                <div class="footer" class:hasCustomBackground>
                    <ButtonGroup align={"fill"}>
                        {#if chatButton && !me}
                            <Button onClick={handleOpenDirectChat} small
                                ><Translatable resourceKey={i18nKey("profile.chat")} /></Button>
                        {/if}
                        {#if me}
                            <Button onClick={showUserProfile} small
                                ><Translatable resourceKey={i18nKey("profile.settings")} /></Button>
                        {/if}
                        {#if canBlock}
                            <Button onClick={blockUser} small
                                ><Translatable resourceKey={i18nKey("profile.block")} /></Button>
                        {/if}
                        {#if canUnblock}
                            <Button onClick={unblockUser} small
                                ><Translatable resourceKey={i18nKey("profile.unblock")} /></Button>
                        {/if}
                    </ButtonGroup>
                    {#if $platformModeratorStore}
                        <div class="suspend">
                            <ButtonGroup align={"fill"}>
                                {#if isSuspended}
                                    <Button onClick={unsuspendUser} small
                                        ><Translatable
                                            resourceKey={i18nKey("unsuspendUser")} /></Button>
                                {:else}
                                    <Button onClick={suspendUser} small
                                        ><Translatable
                                            resourceKey={i18nKey("suspendUser")} /></Button>
                                {/if}
                            </ButtonGroup>
                        </div>
                    {/if}
                </div>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    .suspend {
        margin-top: $sp3;
    }

    :global(.modal-content .footer.mask-footer) {
        background-color: rgba(0, 0, 0, 0.45);

        @include not-mobile() {
            border-radius: 0 0 var(--modal-rd) var(--modal-rd);
        }
    }
</style>

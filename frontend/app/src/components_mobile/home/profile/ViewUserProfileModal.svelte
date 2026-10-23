<script lang="ts">
    import {
        type OpenChat,
        type ProfileBlock,
        type ResourceKey,
        blockedUsersStore,
        currentUserIdStore,
        platformModeratorStore,
        profileBlock,
        unsuspendUserMessage,
        publish,
        selectedChatBlockedUsersStore,
        selectedChatSummaryStore,
        selectedCommunityBlockedUsersStore,
        selectedCommunitySummaryStore,
    } from "@client";

    import { CommonButton, Container, Sheet } from "component-lib";
    import { navigate } from "@utils/navigation";
    import { ProfileCardData } from "@src/logic/profile/profileCardData.svelte";
    import { getContext } from "svelte";
    import AccountCancel from "svelte-material-icons/AccountCancelOutline.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import ChatOutline from "svelte-material-icons/ChatOutline.svelte";
    import Cog from "svelte-material-icons/Cog.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Translatable from "@shared_components/Translatable.svelte";
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

    const card = new ProfileCardData(client, userId, onClose);
    let profile = $derived(card.profile);
    let user = $derived(card.user);

    function afterBlock(result: boolean, success: ResourceKey, failure: ResourceKey) {
        if (!result) {
            toastStore.showFailureToast(failure);
        } else {
            toastStore.showSuccessToast(success);
        }
    }

    async function blockUser(block: ProfileBlock) {
        if (block.kind === "none") return;
        onClose();
        if (block.kind === "block") {
            afterBlock(
                await client.blockUserInContext(block.context, userId),
                i18nKey("blockUserSucceeded"),
                i18nKey("blockUserFailed"),
            );
        } else {
            afterBlock(
                await client.unblockUserInContext(block.context, userId),
                i18nKey("unblockUserSucceeded"),
                i18nKey("unblockUserFailed"),
            );
        }
    }

    function handleOpenDirectChat() {
        onOpenDirectChat();
    }

    function showUserProfile() {
        navigate("/profile_summary");
        onClose();
    }

    async function unsuspendUser() {
        const success = await client.unsuspendUser(userId);
        afterBlock(success, unsuspendUserMessage(true), unsuspendUserMessage(false));
        if (success) onClose();
    }

    function suspendUser() {
        publish("suspendUser", userId);
        onClose();
    }
    let me = $derived(userId === $currentUserIdStore);
    let isSuspended = $derived(user?.suspended ?? false);
    let block = $derived(
        profileBlock({
            userId,
            isMe: me,
            inGlobalContext,
            chat: $selectedChatSummaryStore,
            community: $selectedCommunitySummaryStore,
            blockedUsers: $blockedUsersStore,
            blockedChatUsers: $selectedChatBlockedUsersStore,
            blockedCommunityUsers: $selectedCommunityBlockedUsersStore,
            canBlockUsers: (id) => client.canBlockUsers(id),
        }),
    );
</script>

{#if profile !== undefined}
    <Sheet onDismiss={onClose}>
        {#if profile !== undefined && user !== undefined}
            <!-- <UserProfileCard {user} {profile} {inGlobalContext} {onClose}></UserProfileCard> -->
            <Container direction={"vertical"} padding={["md", "md", "lg", "md"]}>
                <UserProfileSummaryCard mode={"view"} {user} {profile}></UserProfileSummaryCard>
                <Container mainAxisAlignment={"center"} gap={"xs"}>
                    {#if chatButton && !me}
                        <CommonButton onClick={handleOpenDirectChat} mode={"active"}>
                            {#snippet icon(color, size)}
                                <ChatOutline {color} {size} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey("profile.chat")} />
                        </CommonButton>
                    {/if}
                    {#if me}
                        <CommonButton onClick={showUserProfile} mode={"active"}>
                            {#snippet icon(color, size)}
                                <Cog {color} {size} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey("profile.label")} />
                        </CommonButton>
                    {/if}
                    {#if block.kind !== "none"}
                        <CommonButton onClick={() => blockUser(block)} mode={"active"}>
                            {#snippet icon(color, size)}
                                <Cancel {color} {size} />
                            {/snippet}
                            <Translatable
                                resourceKey={i18nKey(
                                    block.kind === "block" ? "profile.block" : "profile.unblock",
                                )} />
                        </CommonButton>
                    {/if}
                    {#if $platformModeratorStore}
                        {#if isSuspended}
                            <CommonButton onClick={unsuspendUser} mode={"active"}>
                                {#snippet icon(color, size)}
                                    <AccountCancel {color} {size} />
                                {/snippet}
                                <Translatable resourceKey={i18nKey("unsuspendUser")} />
                            </CommonButton>
                        {:else}
                            <CommonButton onClick={suspendUser} mode={"active"}>
                                {#snippet icon(color, size)}
                                    <AccountCancel {color} {size} />
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

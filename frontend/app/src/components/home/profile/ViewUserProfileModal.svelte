<script lang="ts">
    import {
        type OpenChat,
        type ProfileBlock,
        type ResourceKey,
        currentUserIdStore,
        mobileWidth,
        platformModeratorStore,
        unsuspendUserMessage,
        publish,
        setRightPanelHistory,
    } from "@client";

    import { ProfileCardBlock, ProfileCardData } from "@src/logic/profile/profileCardData.svelte";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import UserProfileCard from "./UserProfileCard.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        userId: string;
        alignTo?: HTMLElement | undefined;
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

    const card = new ProfileCardData(client, userId, onClose);
    let profile = $derived(card.profile);
    let user = $derived(card.user);
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

    const rendering = card.loaded;

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
        setRightPanelHistory([{ kind: "user_profile" }]);
        onClose();
    }

    function onWindowResize() {
        if (!modal) {
            onClose();
        }
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
    let modal = $derived($mobileWidth);
    const cardBlock = new ProfileCardBlock(client, userId, inGlobalContext);
    let block = $derived(cardBlock.current);
</script>

<svelte:window onresize={onWindowResize} />

{#if profile !== undefined}
    <Overlay dismissible {onClose}>
        <ModalContent
            fill
            {rendering}
            compactFooter
            backgroundImage={backgroundUrl}
            hideFooter={!me && !chatButton && block.kind === "none"}
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
                        {#if block.kind !== "none"}
                            <Button onClick={() => blockUser(block)} small
                                ><Translatable
                                    resourceKey={i18nKey(
                                        block.kind === "block" ? "profile.block" : "profile.unblock",
                                    )} /></Button>
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

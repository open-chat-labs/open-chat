<script lang="ts">
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import Reply from "svelte-material-icons/Reply.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import ReplyOutline from "svelte-material-icons/ReplyOutline.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import Flag from "svelte-material-icons/Flag.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import DeleteOffOutline from "svelte-material-icons/DeleteOffOutline.svelte";
    import TranslateIcon from "svelte-material-icons/Translate.svelte";
    import EyeIcon from "svelte-material-icons/Eye.svelte";
    import TranslateOff from "svelte-material-icons/TranslateOff.svelte";
    import ForwardIcon from "svelte-material-icons/Share.svelte";
    import Pin from "svelte-material-icons/Pin.svelte";
    import PinOff from "svelte-material-icons/PinOff.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import CollapseIcon from "svelte-material-icons/ArrowCollapseUp.svelte";
    import EyeArrowRightIcon from "svelte-material-icons/EyeArrowRight.svelte";
    import EyeOffIcon from "svelte-material-icons/EyeOff.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import ChatPlusOutline from "svelte-material-icons/ChatPlusOutline.svelte";
    import EmoticonOutline from "svelte-material-icons/EmoticonOutline.svelte";
    import ClockPlusOutline from "svelte-material-icons/ClockPlusOutline.svelte";
    import ClockRemoveOutline from "svelte-material-icons/ClockRemoveOutline.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Bitcoin from "../icons/Bitcoin.svelte";
    import { _, locale } from "svelte-i18n";
    import { translationCodes, i18nKey } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import { iconSize } from "../../stores/iconSize";
    import { createEventDispatcher, getContext } from "svelte";
    import {
        LEDGER_CANISTER_ICP,
        type ChatIdentifier,
        type Message,
        type OpenChat,
        lastCryptoSent,
        currentUser as user,
        translationStore,
        isDiamond,
        cryptoLookup,
        threadsFollowedByMeStore,
    } from "openchat-client";
    import { toastStore } from "../../stores/toast";
    import * as shareFunctions from "../../utils/share";
    import { now } from "../../stores/time";
    import { copyToClipboard } from "../../utils/urls";
    import { isTouchOnlyDevice } from "../../utils/devices";
    import Translatable from "../Translatable.svelte";
    import { quickReactions } from "../../stores/quickReactions";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let chatId: ChatIdentifier;
    export let isProposal: boolean;
    export let inert: boolean;
    export let publicGroup: boolean;
    export let confirmed: boolean;
    export let failed: boolean;
    export let canShare: boolean;
    export let me: boolean;
    export let canPin: boolean;
    export let pinned: boolean;
    export let supportsReply: boolean;
    export let canQuoteReply: boolean;
    export let canStartThread: boolean;
    export let multiUserChat: boolean;
    export let canForward: boolean;
    export let canBlockUser: boolean;
    export let canEdit: boolean;
    export let canDelete: boolean;
    export let canUndelete: boolean;
    export let canRevealDeleted: boolean;
    export let canRevealBlocked: boolean;
    export let canReact: boolean;
    export let translatable: boolean;
    export let translated: boolean;
    export let msg: Message;
    export let threadRootMessage: Message | undefined;
    export let canTip: boolean;
    export let selectQuickReaction: (unicode: string) => void;
    export let showEmojiPicker: () => void;

    let menuIcon: MenuIcon;
    let quickReactionIconSize = "1.2rem";

    $: canRemind =
        msg.content.kind !== "message_reminder_content" &&
        msg.content.kind !== "message_reminder_created_content";
    $: canCancelRemind =
        msg.content.kind === "message_reminder_created_content" && msg.content.remindAt > $now;
    $: canDeleteMessage =
        (canDelete || me) &&
        !inert &&
        !(msg.content.kind === "video_call_content" && msg.content.ended === undefined);
    $: inThread = threadRootMessage !== undefined;
    $: threadRootMessageIndex =
        msg.messageId === threadRootMessage?.messageId
            ? undefined
            : threadRootMessage?.messageIndex;
    $: isFollowedByMe =
        threadRootMessage !== undefined &&
        ($threadsFollowedByMeStore.get(chatId)?.has(threadRootMessage.messageIndex) ?? false);
    $: canFollow = threadRootMessage !== undefined && !isFollowedByMe;
    $: canUnfollow = isFollowedByMe;

    export function showMenu() {
        menuIcon?.showMenu();
    }

    function blockUser() {
        if (!canBlockUser || chatId.kind !== "group_chat") return;
        client.blockUser(chatId, msg.sender).then((success) => {
            if (success) {
                toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("blockUserFailed"));
            }
        });
    }

    function collapseMessage() {
        dispatch("collapseMessage");
    }

    function remindMe() {
        dispatch("remindMe");
    }

    function cancelReminder() {
        if (msg.content.kind === "message_reminder_created_content") {
            dispatch("cancelReminder", msg.content);
        }
    }

    function shareMessage() {
        shareFunctions.shareMessage(
            $_,
            $user.userId,
            msg.sender === $user.userId,
            msg,
            $cryptoLookup,
        );
    }

    function copyMessageUrl() {
        shareFunctions.copyMessageUrl(chatId, msg.messageIndex, threadRootMessageIndex);
    }

    function copyMessage() {
        copyToClipboard(client.getContentAsText($_, msg.content));
    }

    function pinMessage() {
        if (!canPin || inThread || chatId.kind === "direct_chat") return;
        client.pinMessage(chatId, msg.messageIndex).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("pinMessageFailed"));
            }
        });
    }

    function unpinMessage() {
        if (!canPin || inThread || chatId.kind === "direct_chat") return;
        client.unpinMessage(chatId, msg.messageIndex).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("unpinMessageFailed"));
            }
        });
    }

    // this is called if we are starting a new thread so we pass undefined as the threadSummary param
    function initiateThread() {
        dispatch("initiateThread");
    }

    function forward() {
        dispatch("forward", msg);
    }

    function retrySend() {
        dispatch("retrySend");
    }

    function reportMessage() {
        dispatch("reportMessage");
    }

    function deleteMessage() {
        if (failed) {
            dispatch("deleteFailedMessage");
            return;
        }
        if (!canDeleteMessage) return;
        client.deleteMessage(chatId, threadRootMessageIndex, msg.messageId);
    }

    function undeleteMessage() {
        if (!canUndelete) return;
        client.undeleteMessage(chatId, threadRootMessageIndex, msg).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("undeleteMessageFailed"));
            }
        });
    }

    function revealDeletedMessage() {
        if (canRevealDeleted) {
            client.revealDeletedMessage(chatId, msg.messageId, threadRootMessageIndex);
        } else if (canRevealBlocked) {
            client.revealBlockedMessage(msg.messageId);
        }
    }

    function untranslateMessage() {
        translationStore.untranslate(msg.messageId);
    }

    function translateMessage() {
        if (!$isDiamond) {
            dispatch("upgrade");
        } else {
            const text = client.getMessageText(msg.content);
            if (text !== undefined) {
                getTranslation(text, msg.messageId);
            }
        }
    }

    function getTranslation(text: string, messageId: bigint) {
        const params = new URLSearchParams();
        params.append("q", text);
        params.append("target", translationCodes[$locale || "en"] || "en");
        params.append("format", "text");
        params.append("key", process.env.PUBLIC_TRANSLATE_API_KEY!);
        fetch(`https://translation.googleapis.com/language/translate/v2?${params}`, {
            method: "POST",
        })
            .then((resp) => resp.json())
            .then(({ data: { translations } }) => {
                if (Array.isArray(translations) && translations.length > 0) {
                    translationStore.translate(messageId, translations[0].translatedText);
                }
            })
            .catch((_err) => {
                toastStore.showFailureToast(i18nKey("unableToTranslate"));
            });
    }

    function followThread(follow: boolean) {
        if ((follow && !canFollow) || (!follow && !canUnfollow)) {
            return;
        }

        const rootMessage = threadRootMessage ?? msg;
        client.followThread(chatId, rootMessage, follow).then((success) => {
            if (!success) {
                if (follow) {
                    toastStore.showFailureToast(i18nKey("followThreadFailed"));
                } else {
                    toastStore.showFailureToast(i18nKey("unfollowThreadFailed"));
                }
            }
        });
    }
</script>

<div class="menu" class:touch={isTouchOnlyDevice} class:inert class:rtl={$rtlStore}>
    {#if !inert && !isTouchOnlyDevice}
        {#each $quickReactions as reaction}
            <HoverIcon compact onclick={() => selectQuickReaction(reaction)}>
                <div class="quick-reaction">
                    {reaction}
                </div>
            </HoverIcon>
        {/each}
        {#if canReact && !failed}
            <HoverIcon compact onclick={() => showEmojiPicker()} title={$_("pickEmoji")}>
                <div class="quick-reaction">
                    <EmoticonOutline size={quickReactionIconSize} color={"var(--menu-txt)"} />
                </div>
            </HoverIcon>
        {/if}
        {#if confirmed && supportsReply && !failed}
            {#if !inThread && canStartThread}
                <HoverIcon compact onclick={() => initiateThread()} title={$_("thread.menu")}>
                    <div class="quick-reaction">
                        <ChatPlusOutline size={quickReactionIconSize} color={"var(--menu-txt)"} />
                    </div>
                </HoverIcon>
            {/if}
            {#if canQuoteReply && !me}
                <HoverIcon compact onclick={() => dispatch("reply")} title={$_("quoteReply")}>
                    <div class="quick-reaction">
                        <Reply size={quickReactionIconSize} color={"var(--menu-txt)"} />
                    </div>
                </HoverIcon>
            {/if}
            {#if canEdit && !failed}
                <HoverIcon
                    compact
                    onclick={() => dispatch("editMessage")}
                    title={$_("editMessage")}>
                    <div class="quick-reaction">
                        <PencilOutline size={quickReactionIconSize} color={"var(--menu-txt)"} />
                    </div>
                </HoverIcon>
            {/if}
        {/if}
    {/if}
    <MenuIcon bind:this={menuIcon} centered position={"right"} align={"end"}>
        <div class="quick-reaction" slot="icon">
            <HoverIcon compact>
                <DotsVertical size="1.625em" color={"var(--menu-txt)"} />
            </HoverIcon>
        </div>
        <div slot="menu">
            <Menu centered>
                {#if isProposal && !inert}
                    <MenuItem on:click={collapseMessage}>
                        <CollapseIcon
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("proposal.collapse")} />
                        </div>
                    </MenuItem>
                {/if}
                {#if confirmed && !inert && !failed}
                    {#if canFollow}
                        <MenuItem on:click={() => followThread(true)}>
                            <EyeArrowRightIcon
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">
                                <Translatable resourceKey={i18nKey("followThread")} />
                            </div>
                        </MenuItem>
                    {:else if canUnfollow}
                        <MenuItem on:click={() => followThread(false)}>
                            <EyeOffIcon
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">
                                <Translatable resourceKey={i18nKey("unfollowThread")} />
                            </div>
                        </MenuItem>
                    {/if}
                    {#if publicGroup && canShare}
                        <MenuItem on:click={shareMessage}>
                            <ShareIcon
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text"><Translatable resourceKey={i18nKey("share")} /></div>
                        </MenuItem>
                    {/if}
                    <MenuItem on:click={copyMessageUrl}>
                        <ContentCopy
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("copyMessageUrl")} />
                        </div>
                    </MenuItem>
                {/if}
                {#if isTouchOnlyDevice}
                    <MenuItem on:click={copyMessage}>
                        <ContentCopy
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text"><Translatable resourceKey={i18nKey("copy")} /></div>
                    </MenuItem>
                {/if}
                {#if canRemind && confirmed && !inert && !failed}
                    <MenuItem on:click={remindMe}>
                        <ClockPlusOutline
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("reminders.menu")} />
                        </div>
                    </MenuItem>
                {/if}
                {#if canCancelRemind && confirmed && !inert && !failed}
                    <MenuItem on:click={cancelReminder}>
                        <ClockRemoveOutline
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("reminders.cancel")} />
                        </div>
                    </MenuItem>
                {/if}
                {#if confirmed && canPin && !inThread && !inert && !failed}
                    {#if pinned}
                        <MenuItem on:click={unpinMessage}>
                            <PinOff
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">
                                <Translatable resourceKey={i18nKey("unpinMessage")} />
                            </div>
                        </MenuItem>
                    {:else}
                        <MenuItem on:click={pinMessage}>
                            <Pin size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                            <div slot="text">
                                <Translatable resourceKey={i18nKey("pinMessage")} />
                            </div>
                        </MenuItem>
                    {/if}
                {/if}
                {#if confirmed && supportsReply && !inert && !failed}
                    {#if canQuoteReply}
                        <MenuItem on:click={() => dispatch("reply")}>
                            <Reply
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">
                                <Translatable resourceKey={i18nKey("quoteReply")} />
                            </div>
                        </MenuItem>
                    {/if}
                    {#if !inThread && canStartThread}
                        <MenuItem on:click={initiateThread}>
                            <ChatPlusOutline
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">
                                <Translatable resourceKey={i18nKey("thread.menu")} />
                            </div>
                        </MenuItem>
                    {/if}
                {/if}
                {#if canForward && !inThread && !inert && !failed}
                    <MenuItem on:click={forward}>
                        <ForwardIcon
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text"><Translatable resourceKey={i18nKey("forward")} /></div>
                    </MenuItem>
                {/if}
                {#if confirmed && multiUserChat && !inThread && !me && !isProposal && !inert && !failed}
                    <MenuItem on:click={() => dispatch("replyPrivately")}>
                        <ReplyOutline
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("replyPrivately")} />
                        </div>
                    </MenuItem>
                {/if}
                {#if !me && translatable && !failed}
                    {#if translated}
                        <MenuItem on:click={untranslateMessage}>
                            <TranslateOff
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">
                                <Translatable resourceKey={i18nKey("untranslateMessage")} />
                            </div>
                        </MenuItem>
                    {:else}
                        <MenuItem on:click={translateMessage}>
                            <TranslateIcon
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">
                                <Translatable resourceKey={i18nKey("translateMessage")} />
                            </div>
                        </MenuItem>
                    {/if}
                {/if}
                {#if canEdit && !inert && !failed}
                    <MenuItem on:click={() => dispatch("editMessage")}>
                        <PencilOutline
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text"><Translatable resourceKey={i18nKey("editMessage")} /></div>
                    </MenuItem>
                {/if}
                {#if canTip}
                    <MenuItem
                        on:click={() =>
                            dispatch("tipMessage", $lastCryptoSent ?? LEDGER_CANISTER_ICP)}>
                        <Bitcoin size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                        <div slot="text"><Translatable resourceKey={i18nKey("tip.menu")} /></div>
                    </MenuItem>
                {/if}
                <MenuItem separator />
                {#if confirmed && multiUserChat && !me && canBlockUser && !failed}
                    <MenuItem on:click={blockUser}>
                        <Cancel size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                        <div slot="text"><Translatable resourceKey={i18nKey("blockUser")} /></div>
                    </MenuItem>
                {/if}
                {#if canDeleteMessage}
                    <MenuItem on:click={deleteMessage}>
                        <DeleteOutline
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text">
                            {#if multiUserChat || me}
                                <Translatable resourceKey={i18nKey("deleteMessage")} />
                            {:else}
                                <Translatable resourceKey={i18nKey("deleteMessageForMe")} />
                            {/if}
                        </div>
                    </MenuItem>
                {/if}
                {#if confirmed && !me && !inert}
                    <MenuItem on:click={reportMessage}>
                        <Flag size={$iconSize} color={"var(--error)"} slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("report.menu")} />
                        </div>
                    </MenuItem>
                {/if}
                {#if canRevealDeleted || canRevealBlocked}
                    <MenuItem on:click={revealDeletedMessage}>
                        <EyeIcon size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("revealDeletedMessage")} />
                        </div>
                    </MenuItem>
                {/if}
                {#if canUndelete}
                    <MenuItem on:click={undeleteMessage}>
                        <DeleteOffOutline
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("undeleteMessage")} />
                        </div>
                    </MenuItem>
                {/if}
                {#if failed}
                    <MenuItem on:click={retrySend}>
                        <Refresh size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("retryMessage")} />
                        </div>
                    </MenuItem>
                {/if}
            </Menu>
        </div>
    </MenuIcon>
</div>

<style lang="scss">
    // This will align the menu relative to the selected side of the chat
    // bubble with 0.75rem overflow, or align it to the opposite edge of the
    // chat bubble if the menu width is larger than the chat bubble's.
    @mixin calcMenuOffset($property, $menu-width) {
        #{$property}: calc(100% - min(100%, calc($menu-width - 0.75rem)));
    }

    // We're expecting a number of menu items, plus one hidden item, hence the
    // `$count + 1`
    @mixin setMenuOffsetByMenuItemCount($count, $menu-width) {
        :global(.bubble-wrapper > .menu:has(> :nth-child(#{$count + 1}):last-child)) {
            &:not(.rtl) {
                @include calcMenuOffset(left, $menu-width);
            }
            &.rtl {
                @include calcMenuOffset(right, $menu-width);
            }
        }
    }

    .menu {
        position: absolute;
    }

    .menu:not(.touch) {
        width: fit-content;
        background-color: var(--menu-bg);
        border: var(--bw) solid var(--menu-bd);

        top: -1.5rem;
        padding: 0.125rem;
        border-radius: 0.375rem;

        :global(.menu-icon) {
            width: 2.125rem;
            height: 2.125rem;
            padding: 0.25rem;
        }
    }

    .menu.touch {
        height: 0;
        overflow: hidden;
    }

    @include setMenuOffsetByMenuItemCount(1, 2.5rem);
    @include setMenuOffsetByMenuItemCount(2, 4.625rem);
    @include setMenuOffsetByMenuItemCount(3, 6.75rem);
    @include setMenuOffsetByMenuItemCount(4, 8.875rem);
    @include setMenuOffsetByMenuItemCount(5, 11rem);
    @include setMenuOffsetByMenuItemCount(6, 13.125rem);
    @include setMenuOffsetByMenuItemCount(7, 15.25rem);
    @include setMenuOffsetByMenuItemCount(8, 17.375rem);

    .quick-reaction {
        width: 1.625rem;
        height: 1.625rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>

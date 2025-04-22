<script lang="ts">
    import {
        app,
        cryptoLookup,
        isDiamond,
        lastCryptoSent,
        LEDGER_CANISTER_ICP,
        publish,
        routeForMessage,
        threadsFollowedByMeStore,
        translationStore,
        ui,
        currentUser as user,
        type ChatIdentifier,
        type Message,
        type MessageReminderCreatedContent,
        type OpenChat,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { _, locale } from "svelte-i18n";
    import CollapseIcon from "svelte-material-icons/ArrowCollapseUp.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import ChatPlusOutline from "svelte-material-icons/ChatPlusOutline.svelte";
    import ClockPlusOutline from "svelte-material-icons/ClockPlusOutline.svelte";
    import ClockRemoveOutline from "svelte-material-icons/ClockRemoveOutline.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import DeleteOffOutline from "svelte-material-icons/DeleteOffOutline.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import EmoticonOutline from "svelte-material-icons/EmoticonOutline.svelte";
    import EyeIcon from "svelte-material-icons/Eye.svelte";
    import EyeArrowRightIcon from "svelte-material-icons/EyeArrowRight.svelte";
    import EyeOffIcon from "svelte-material-icons/EyeOff.svelte";
    import Flag from "svelte-material-icons/Flag.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import Pin from "svelte-material-icons/Pin.svelte";
    import PinOff from "svelte-material-icons/PinOff.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import Reply from "svelte-material-icons/Reply.svelte";
    import ReplyOutline from "svelte-material-icons/ReplyOutline.svelte";
    import ForwardIcon from "svelte-material-icons/Share.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import TranslateIcon from "svelte-material-icons/Translate.svelte";
    import TranslateOff from "svelte-material-icons/TranslateOff.svelte";
    import { i18nKey, translationCodes } from "../../i18n/i18n";
    import { quickReactions } from "../../stores/quickReactions";
    import { rtlStore } from "../../stores/rtl";
    import { now } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import { isTouchOnlyDevice } from "../../utils/devices";
    import * as shareFunctions from "../../utils/share";
    import { copyToClipboard } from "../../utils/urls";
    import HoverIcon from "../HoverIcon.svelte";
    import Bitcoin from "../icons/Bitcoin.svelte";
    import Menu from "../Menu.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import MenuItem from "../MenuItem.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: ChatIdentifier;
        isProposal: boolean;
        inert: boolean;
        publicGroup: boolean;
        confirmed: boolean;
        failed: boolean;
        canShare: boolean;
        me: boolean;
        canPin: boolean;
        pinned: boolean;
        supportsReply: boolean;
        canQuoteReply: boolean;
        canStartThread: boolean;
        multiUserChat: boolean;
        canForward: boolean;
        canBlockUser: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canUndelete: boolean;
        canRevealDeleted: boolean;
        canRevealBlocked: boolean;
        canReact: boolean;
        translatable: boolean;
        translated: boolean;
        msg: Message;
        threadRootMessage: Message | undefined;
        canTip: boolean;
        selectQuickReaction: (unicode: string) => void;
        showEmojiPicker: () => void;
        onCollapseMessage?: () => void;
        onRemindMe: () => void;
        onCancelReminder: (content: MessageReminderCreatedContent) => void;
        onRetrySend?: () => void;
        onReportMessage: () => void;
        onDeleteFailedMessage?: () => void;
        onReply: () => void;
        onEditMessage: () => void;
        onReplyPrivately: () => void;
        onTipMessage: (ledger: string) => void;
    }

    let {
        chatId,
        isProposal,
        inert,
        publicGroup,
        confirmed,
        failed,
        canShare,
        me,
        canPin,
        pinned,
        supportsReply,
        canQuoteReply,
        canStartThread,
        multiUserChat,
        canForward,
        canBlockUser,
        canEdit,
        canDelete,
        canUndelete,
        canRevealDeleted,
        canRevealBlocked,
        canReact,
        translatable,
        translated,
        msg,
        threadRootMessage,
        canTip,
        selectQuickReaction,
        showEmojiPicker,
        onCollapseMessage,
        onRemindMe,
        onCancelReminder,
        onRetrySend,
        onReportMessage,
        onDeleteFailedMessage,
        onReply,
        onEditMessage,
        onReplyPrivately,
        onTipMessage,
    }: Props = $props();

    let menuIconEl: MenuIcon | undefined = $state();
    let quickReactionIconSize = "1.2rem";

    let canRemind = $derived(
        msg.content.kind !== "message_reminder_content" &&
            msg.content.kind !== "message_reminder_created_content",
    );
    let canCancelRemind = $derived(
        msg.content.kind === "message_reminder_created_content" && msg.content.remindAt > $now,
    );
    let canDeleteMessage = $derived(
        (canDelete || me) &&
            !inert &&
            !(msg.content.kind === "video_call_content" && msg.content.ended === undefined),
    );
    let inThread = $derived(threadRootMessage !== undefined);
    let threadRootMessageIndex = $derived(
        msg.messageId === threadRootMessage?.messageId
            ? undefined
            : threadRootMessage?.messageIndex,
    );
    let isFollowedByMe = $derived(
        threadRootMessage !== undefined &&
            ($threadsFollowedByMeStore.get(chatId)?.has(threadRootMessage.messageIndex) ?? false),
    );
    let canFollow = $derived(threadRootMessage !== undefined && !isFollowedByMe);
    let canUnfollow = $derived(isFollowedByMe);

    export function showMenu() {
        menuIconEl?.showMenu();
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

    function cancelReminder() {
        if (msg.content.kind === "message_reminder_created_content") {
            onCancelReminder(msg.content);
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

    function forward() {
        publish("forward", msg);
    }

    function deleteMessage() {
        if (failed) {
            onDeleteFailedMessage?.();
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
            publish("upgrade");
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
        params.append("key", import.meta.env.OC_PUBLIC_TRANSLATE_API_KEY!);
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

    function initiateThread() {
        page(`${routeForMessage(app.chatListScope.kind, { chatId }, msg.messageIndex)}?open=true`);
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
                <HoverIcon compact onclick={initiateThread} title={$_("thread.menu")}>
                    <div class="quick-reaction">
                        <ChatPlusOutline size={quickReactionIconSize} color={"var(--menu-txt)"} />
                    </div>
                </HoverIcon>
            {/if}
            {#if canQuoteReply && !me}
                <HoverIcon compact onclick={onReply} title={$_("quoteReply")}>
                    <div class="quick-reaction">
                        <Reply size={quickReactionIconSize} color={"var(--menu-txt)"} />
                    </div>
                </HoverIcon>
            {/if}
            {#if canEdit && !failed}
                <HoverIcon compact onclick={onEditMessage} title={$_("editMessage")}>
                    <div class="quick-reaction">
                        <PencilOutline size={quickReactionIconSize} color={"var(--menu-txt)"} />
                    </div>
                </HoverIcon>
            {/if}
        {/if}
    {/if}
    <MenuIcon bind:this={menuIconEl} centered position={"right"} align={"end"}>
        {#snippet menuIcon()}
            <div class="quick-reaction">
                <HoverIcon compact>
                    <DotsVertical size="1.625em" color={"var(--menu-txt)"} />
                </HoverIcon>
            </div>
        {/snippet}
        {#snippet menuItems()}
            <Menu centered>
                {#if isProposal && !inert}
                    <MenuItem onclick={onCollapseMessage}>
                        {#snippet icon()}
                            <CollapseIcon size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("proposal.collapse")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if confirmed && !inert && !failed}
                    {#if canFollow}
                        <MenuItem onclick={() => followThread(true)}>
                            {#snippet icon()}
                                <EyeArrowRightIcon
                                    size={ui.iconSize}
                                    color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <div>
                                    <Translatable resourceKey={i18nKey("followThread")} />
                                </div>
                            {/snippet}
                        </MenuItem>
                    {:else if canUnfollow}
                        <MenuItem onclick={() => followThread(false)}>
                            {#snippet icon()}
                                <EyeOffIcon size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <div>
                                    <Translatable resourceKey={i18nKey("unfollowThread")} />
                                </div>
                            {/snippet}
                        </MenuItem>
                    {/if}
                    {#if publicGroup && canShare}
                        <MenuItem onclick={shareMessage}>
                            {#snippet icon()}
                                <ShareIcon size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <div><Translatable resourceKey={i18nKey("share")} /></div>
                            {/snippet}
                        </MenuItem>
                    {/if}
                    <MenuItem onclick={copyMessageUrl}>
                        {#snippet icon()}
                            <ContentCopy size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("copyMessageUrl")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
                <MenuItem onclick={copyMessage}>
                    {#snippet icon()}
                        <ContentCopy size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                    {/snippet}
                    {#snippet text()}
                        <div><Translatable resourceKey={i18nKey("copy")} /></div>
                    {/snippet}
                </MenuItem>
                {#if canRemind && confirmed && !inert && !failed}
                    <MenuItem onclick={onRemindMe}>
                        {#snippet icon()}
                            <ClockPlusOutline
                                size={ui.iconSize}
                                color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("reminders.menu")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if canCancelRemind && confirmed && !inert && !failed}
                    <MenuItem onclick={cancelReminder}>
                        {#snippet icon()}
                            <ClockRemoveOutline
                                size={ui.iconSize}
                                color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("reminders.cancel")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if confirmed && canPin && !inThread && !inert && !failed}
                    {#if pinned}
                        <MenuItem onclick={unpinMessage}>
                            {#snippet icon()}
                                <PinOff size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <div>
                                    <Translatable resourceKey={i18nKey("unpinMessage")} />
                                </div>
                            {/snippet}
                        </MenuItem>
                    {:else}
                        <MenuItem onclick={pinMessage}>
                            {#snippet icon()}
                                <Pin size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <div>
                                    <Translatable resourceKey={i18nKey("pinMessage")} />
                                </div>
                            {/snippet}
                        </MenuItem>
                    {/if}
                {/if}
                {#if confirmed && supportsReply && !inert && !failed}
                    {#if canQuoteReply}
                        <MenuItem onclick={onReply}>
                            {#snippet icon()}
                                <Reply size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <div>
                                    <Translatable resourceKey={i18nKey("quoteReply")} />
                                </div>
                            {/snippet}
                        </MenuItem>
                    {/if}
                    {#if !inThread && canStartThread}
                        <MenuItem onclick={initiateThread}>
                            {#snippet icon()}
                                <ChatPlusOutline
                                    size={ui.iconSize}
                                    color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <div>
                                    <Translatable resourceKey={i18nKey("thread.menu")} />
                                </div>
                            {/snippet}
                        </MenuItem>
                    {/if}
                {/if}
                {#if canForward && !inThread && !inert && !failed}
                    <MenuItem onclick={forward}>
                        {#snippet icon()}
                            <ForwardIcon size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div><Translatable resourceKey={i18nKey("forward")} /></div>
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if confirmed && multiUserChat && !inThread && !me && !isProposal && !inert && !failed}
                    <MenuItem onclick={onReplyPrivately}>
                        {#snippet icon()}
                            <ReplyOutline size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("replyPrivately")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if !me && translatable && !failed}
                    {#if translated}
                        <MenuItem onclick={untranslateMessage}>
                            {#snippet icon()}
                                <TranslateOff
                                    size={ui.iconSize}
                                    color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <div>
                                    <Translatable resourceKey={i18nKey("untranslateMessage")} />
                                </div>
                            {/snippet}
                        </MenuItem>
                    {:else}
                        <MenuItem onclick={translateMessage}>
                            {#snippet icon()}
                                <TranslateIcon
                                    size={ui.iconSize}
                                    color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <div>
                                    <Translatable resourceKey={i18nKey("translateMessage")} />
                                </div>
                            {/snippet}
                        </MenuItem>
                    {/if}
                {/if}
                {#if canEdit && !inert && !failed}
                    <MenuItem onclick={onEditMessage}>
                        {#snippet icon()}
                            <PencilOutline size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div><Translatable resourceKey={i18nKey("editMessage")} /></div>
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if canTip}
                    <MenuItem onclick={() => onTipMessage($lastCryptoSent ?? LEDGER_CANISTER_ICP)}>
                        {#snippet icon()}
                            <Bitcoin size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div><Translatable resourceKey={i18nKey("tip.menu")} /></div>
                        {/snippet}
                    </MenuItem>
                {/if}
                <MenuItem separator />
                {#if confirmed && multiUserChat && !me && canBlockUser && !failed}
                    <MenuItem onclick={blockUser}>
                        {#snippet icon()}
                            <Cancel size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div><Translatable resourceKey={i18nKey("blockUser")} /></div>
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if canDeleteMessage}
                    <MenuItem onclick={deleteMessage}>
                        {#snippet icon()}
                            <DeleteOutline size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                {#if multiUserChat || me}
                                    <Translatable resourceKey={i18nKey("deleteMessage")} />
                                {:else}
                                    <Translatable resourceKey={i18nKey("deleteMessageForMe")} />
                                {/if}
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if confirmed && !me && !inert}
                    <MenuItem onclick={onReportMessage}>
                        {#snippet icon()}
                            <Flag size={ui.iconSize} color={"var(--error)"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("report.menu")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if canRevealDeleted || canRevealBlocked}
                    <MenuItem onclick={revealDeletedMessage}>
                        {#snippet icon()}
                            <EyeIcon size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("revealDeletedMessage")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if canUndelete}
                    <MenuItem onclick={undeleteMessage}>
                        {#snippet icon()}
                            <DeleteOffOutline
                                size={ui.iconSize}
                                color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("undeleteMessage")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
                {#if failed}
                    <MenuItem onclick={onRetrySend}>
                        {#snippet icon()}
                            <Refresh size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                        {/snippet}
                        {#snippet text()}
                            <div>
                                <Translatable resourceKey={i18nKey("retryMessage")} />
                            </div>
                        {/snippet}
                    </MenuItem>
                {/if}
            </Menu>
        {/snippet}
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

<script lang="ts">
    import { quickReactions } from "@src/stores/quickReactions";
    import { confirmMessageDeletion } from "@src/stores/settings";
    import { Container, IconButton, MenuItem } from "component-lib";
    import {
        chatListScopeStore,
        cryptoLookup,
        currentUserIdStore,
        iconSize,
        isDiamondStore,
        lastCryptoSent,
        LEDGER_CANISTER_ICP,
        publish,
        routeForMessage,
        threadsFollowedByMeStore,
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
    import { now } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import * as shareFunctions from "../../utils/share";
    import { copyToClipboard } from "../../utils/urls";
    import AreYouSure from "../AreYouSure.svelte";
    import Checkbox from "../Checkbox.svelte";
    import Bitcoin from "../icons/Bitcoin.svelte";
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
        canReact: boolean;
        canUndelete: boolean;
        canRevealDeleted: boolean;
        canRevealBlocked: boolean;
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
        canReact,
        canUndelete,
        canRevealDeleted,
        canRevealBlocked,
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

    let showConfirmDelete = $state(false);

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
            $currentUserIdStore,
            msg.sender === $currentUserIdStore,
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

    async function deleteMessage(deletionConfirmed: boolean) {
        if (failed) {
            onDeleteFailedMessage?.();
            return;
        }
        if (!canDeleteMessage) return;

        if (!deletionConfirmed) {
            showConfirmDelete = !showConfirmDelete;
            return;
        }

        showConfirmDelete = false;
        await client.deleteMessage(chatId, threadRootMessageIndex, msg.messageId);
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
        client.untranslate(msg.messageId);
    }

    function translateMessage() {
        if (!$isDiamondStore) {
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
                    client.translate(messageId, translations[0].translatedText);
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
        page(
            `${routeForMessage($chatListScopeStore.kind, { chatId }, msg.messageIndex)}?open=true`,
        );
    }
</script>

{#if showConfirmDelete}
    <AreYouSure action={deleteMessage}>
        <div class="confirm">
            <Translatable resourceKey={i18nKey("deleteMessageConfirm")}></Translatable>
            <div class="dont-show">
                <Checkbox
                    id="dont_show"
                    label={i18nKey("install.dontShow")}
                    checked={!$confirmMessageDeletion}
                    onChange={confirmMessageDeletion.toggle}>
                </Checkbox>
            </div>
        </div>
    </AreYouSure>
{/if}

<Container
    mainAxisAlignment={"spaceBetween"}
    crossAxisAlignment={"center"}
    supplementalClass={"quick_reactions"}
    padding={["zero", "xs", "xs", "xs"]}>
    {#each $quickReactions as reaction}
        <IconButton onclick={() => selectQuickReaction(reaction)}>
            {#snippet icon()}
                <span class="quick-reaction">
                    {reaction}
                </span>
            {/snippet}
        </IconButton>
    {/each}
    {#if canReact && !failed}
        <IconButton onclick={showEmojiPicker}>
            {#snippet icon(color)}
                <EmoticonOutline {color} />
            {/snippet}
        </IconButton>
    {/if}
</Container>
{#if isProposal && !inert}
    <MenuItem onclick={onCollapseMessage}>
        {#snippet icon()}
            <CollapseIcon size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        <Translatable resourceKey={i18nKey("proposal.collapse")} />
    </MenuItem>
{/if}
{#if confirmed && !inert && !failed}
    {#if canFollow}
        <MenuItem onclick={() => followThread(true)}>
            {#snippet icon()}
                <EyeArrowRightIcon size={$iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            <Translatable resourceKey={i18nKey("followThread")} />
        </MenuItem>
    {:else if canUnfollow}
        <MenuItem onclick={() => followThread(false)}>
            {#snippet icon()}
                <EyeOffIcon size={$iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            <Translatable resourceKey={i18nKey("unfollowThread")} />
        </MenuItem>
    {/if}
    {#if publicGroup && canShare}
        <MenuItem onclick={shareMessage}>
            {#snippet icon(color, size)}
                <ShareIcon {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("share")} />
        </MenuItem>
    {/if}
    <MenuItem onclick={copyMessageUrl}>
        {#snippet icon(color, size)}
            <ContentCopy {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("copyMessageUrl")} />
    </MenuItem>
{/if}
<MenuItem onclick={copyMessage}>
    {#snippet icon(color, size)}
        <ContentCopy {color} {size} />
    {/snippet}
    <Translatable resourceKey={i18nKey("copy")} />
</MenuItem>
{#if canRemind && confirmed && !inert && !failed}
    <MenuItem onclick={onRemindMe}>
        {#snippet icon(color, size)}
            <ClockPlusOutline {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("reminders.menu")} />
    </MenuItem>
{/if}
{#if canCancelRemind && confirmed && !inert && !failed}
    <MenuItem onclick={cancelReminder}>
        {#snippet icon(color, size)}
            <ClockRemoveOutline {size} {color} />
        {/snippet}
        <Translatable resourceKey={i18nKey("reminders.cancel")} />
    </MenuItem>
{/if}
{#if confirmed && canPin && !inThread && !inert && !failed}
    {#if pinned}
        <MenuItem onclick={unpinMessage}>
            {#snippet icon(color, size)}
                <PinOff {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("unpinMessage")} />
        </MenuItem>
    {:else}
        <MenuItem onclick={pinMessage}>
            {#snippet icon(color, size)}
                <Pin {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("pinMessage")} />
        </MenuItem>
    {/if}
{/if}
{#if confirmed && supportsReply && !inert && !failed}
    {#if canQuoteReply}
        <MenuItem onclick={onReply}>
            {#snippet icon(color, size)}
                <Reply {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("quoteReply")} />
        </MenuItem>
    {/if}
    {#if !inThread && canStartThread}
        <MenuItem onclick={initiateThread}>
            {#snippet icon(color, size)}
                <ChatPlusOutline {size} {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("thread.menu")} />
        </MenuItem>
    {/if}
{/if}
{#if canForward && !inThread && !inert && !failed}
    <MenuItem onclick={forward}>
        {#snippet icon(color, size)}
            <ForwardIcon {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("forward")} />
    </MenuItem>
{/if}
{#if confirmed && multiUserChat && !inThread && !me && !isProposal && !inert && !failed}
    <MenuItem onclick={onReplyPrivately}>
        {#snippet icon(color, size)}
            <ReplyOutline {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("replyPrivately")} />
    </MenuItem>
{/if}
{#if !me && translatable && !failed}
    {#if translated}
        <MenuItem onclick={untranslateMessage}>
            {#snippet icon(color, size)}
                <TranslateOff {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("untranslateMessage")} />
        </MenuItem>
    {:else}
        <MenuItem onclick={translateMessage}>
            {#snippet icon(color, size)}
                <TranslateIcon {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("translateMessage")} />
        </MenuItem>
    {/if}
{/if}
{#if canEdit && !inert && !failed}
    <MenuItem onclick={onEditMessage}>
        {#snippet icon(color, size)}
            <PencilOutline {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("editMessage")} />
    </MenuItem>
{/if}
{#if canTip}
    <MenuItem onclick={() => onTipMessage($lastCryptoSent ?? LEDGER_CANISTER_ICP)}>
        {#snippet icon(color, size)}
            <Bitcoin {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("tip.menu")} />
    </MenuItem>
{/if}
<MenuItem separator />
{#if confirmed && multiUserChat && !me && canBlockUser && !failed}
    <MenuItem onclick={blockUser}>
        {#snippet icon(color, size)}
            <Cancel {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("blockUser")} />
    </MenuItem>
{/if}
{#if canDeleteMessage}
    <MenuItem onclick={() => deleteMessage(!$confirmMessageDeletion)}>
        {#snippet icon(color, size)}
            <DeleteOutline {color} {size} />
        {/snippet}
        {#if multiUserChat || me}
            <Translatable resourceKey={i18nKey("deleteMessage")} />
        {:else}
            <Translatable resourceKey={i18nKey("deleteMessageForMe")} />
        {/if}
    </MenuItem>
{/if}
{#if confirmed && !me && !inert}
    <MenuItem danger onclick={onReportMessage}>
        {#snippet icon(color, size)}
            <Flag {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("report.menu")} />
    </MenuItem>
{/if}
{#if canRevealDeleted || canRevealBlocked}
    <MenuItem onclick={revealDeletedMessage}>
        {#snippet icon(color, size)}
            <EyeIcon {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("revealDeletedMessage")} />
    </MenuItem>
{/if}
{#if canUndelete}
    <MenuItem onclick={undeleteMessage}>
        {#snippet icon(color, size)}
            <DeleteOffOutline {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("undeleteMessage")} />
    </MenuItem>
{/if}
{#if failed}
    <MenuItem onclick={onRetrySend}>
        {#snippet icon(color, size)}
            <Refresh {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("retryMessage")} />
    </MenuItem>
{/if}

<style lang="scss">
    :global(.container.quick_reactions) {
        border-bottom: var(--bw-thin) solid var(--background-2) !important;
    }

    .quick-reaction {
        font-size: 1.3rem;
    }

    .confirm {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }
    .dont-show {
        @include font(light, normal, fs-80);
    }
</style>

<script lang="ts">
    import { confirmMessageDeletion } from "@src/stores/settings";
    import { disableTipsFeature } from "@src/utils/features";
    import { urlForMediaContent } from "@src/utils/media";
    import { ColourVars, MenuItem, IconButton, type Padding } from "component-lib";
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
    import Download from "svelte-material-icons/CloudDownloadOutline.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import DeleteOffOutline from "svelte-material-icons/DeleteOffOutline.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import EyeIcon from "svelte-material-icons/Eye.svelte";
    import EyeArrowRightIcon from "svelte-material-icons/EyeArrowRight.svelte";
    import EyeOffIcon from "svelte-material-icons/EyeOff.svelte";
    import Flag from "svelte-material-icons/Flag.svelte";
    import Pin from "svelte-material-icons/Pin.svelte";
    import PinOff from "svelte-material-icons/PinOff.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import Reply from "svelte-material-icons/Reply.svelte";
    import ReplyOutline from "svelte-material-icons/ReplyOutline.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import ShareOutline from "svelte-material-icons/ShareOutline.svelte";
    import SquareEditOutline from "svelte-material-icons/SquareEditOutline.svelte";
    import TranslateIcon from "svelte-material-icons/Translate.svelte";
    import TranslateOff from "svelte-material-icons/TranslateOff.svelte";
    import VectorLink from "svelte-material-icons/VectorLink.svelte";
    import { i18nKey, translationCodes } from "../../i18n/i18n";
    import { now } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import * as shareFunctions from "../../utils/share";
    import { copyToClipboard } from "../../utils/urls";
    import Bitcoin from "../icons/Bitcoin.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    type MenuType = "icon_buttons" | "menu_items";

    export interface Props {
        menuType?: MenuType;
        chatId: ChatIdentifier;
        isProposal: boolean;
        inert: boolean;
        publicGroup: boolean;
        confirmed: boolean;
        failed: boolean;
        canShare: boolean;
        me: boolean;
        canPin: boolean;
        canTip: boolean;
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
        translatable: boolean;
        translated: boolean;
        msg: Message;
        threadRootMessage: Message | undefined;
        iconButtonSize?: "xs" | "sm" | "md" | "lg";
        onCollapseMessage?: () => void;
        onRemindMe: () => void;
        onCancelReminder: (content: MessageReminderCreatedContent) => void;
        onRetrySend?: () => void;
        onReportMessage: () => void;
        onReply: () => void;
        onEditMessage: () => void;
        onReplyPrivately: () => void;
        onTipMessage: (ledger: string) => void;
        onDeleteMessage: (confirm: boolean) => void;
        // TODO figure out how and where this is used ???
        onDeleteFailedMessage?: () => void;
        onOptionSelected?: () => void;
    }

    let {
        menuType = "icon_buttons",
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
        translatable,
        translated,
        msg,
        threadRootMessage,
        canTip,
        iconButtonSize,
        onCollapseMessage,
        onRemindMe,
        onCancelReminder,
        onRetrySend,
        onReportMessage,
        onReply,
        onEditMessage,
        onReplyPrivately,
        onTipMessage,
        onDeleteMessage,
        onOptionSelected,
    }: Props = $props();

    let mediaUrl = $derived(urlForMediaContent(msg.content));
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

    async function download(url: string) {
        if (!url) return;

        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.error("Unable to download media", res.status, res.statusText);
                toastStore.showFailureToast(i18nKey("Unable to download media"));
            }
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = objectUrl;
            const disposition = res.headers.get("content-disposition");
            let filename = "download";
            if (disposition && disposition.includes("filename=")) {
                filename = disposition.split("filename=")[1].split(";")[0].replace(/"/g, "");
            } else {
                filename = url.split("/").pop() || "download";
            }
            a.download = filename;
            a.click();
            URL.revokeObjectURL(objectUrl);
        } catch (err) {
            console.error("Unable to download media", err);
            toastStore.showFailureToast(i18nKey("Unable to download media"));
        }
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
        window.setTimeout(() => publish("forward", msg), 250);
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

    type MenuItemTitle =
        | "proposalCollapse"
        | "followThread"
        | "unfollowThread"
        | "share"
        | "copyMessageUrl"
        | "downloadMedia"
        | "copy"
        | "remindersMenu"
        | "remindersCancel"
        | "unpinMessage"
        | "pinMessage"
        | "quoteReply"
        | "threadMenu"
        | "forward"
        | "replyPrivately"
        | "untranslateMessage"
        | "translateMessage"
        | "editMessage"
        | "tipMenu"
        | "blockUser"
        | "deleteMessage"
        | "deleteMessageForMe"
        | "reportMenu"
        | "revealDeletedMessage"
        | "undeleteMessage"
        | "retryMessage";

    function menuItemTitleToKey(menuItemTitle: MenuItemTitle): string {
        switch (menuItemTitle) {
            case "proposalCollapse":
                return "proposal.collapse";
            case "followThread":
                return "followThread";
            case "unfollowThread":
                return "unfollowThread";
            case "share":
                return "share";
            case "copyMessageUrl":
                return "copyMessageUrl";
            case "downloadMedia":
                return "Download media";
            case "copy":
                return "copy";
            case "remindersMenu":
                return "reminders.menu";
            case "remindersCancel":
                return "reminders.cancel";
            case "unpinMessage":
                return "unpinMessage";
            case "pinMessage":
                return "pinMessage";
            case "quoteReply":
                return "quoteReply";
            case "threadMenu":
                return "thread.menu";
            case "forward":
                return "forward";
            case "replyPrivately":
                return "replyPrivately";
            case "untranslateMessage":
                return "untranslateMessage";
            case "translateMessage":
                return "translateMessage";
            case "editMessage":
                return "editMessage";
            case "tipMenu":
                return "tip.menu";
            case "blockUser":
                return "blockUser";
            case "deleteMessage":
                return "deleteMessage";
            case "deleteMessageForMe":
                return "deleteMessageForMe";
            case "reportMenu":
                return "report.menu";
            case "revealDeletedMessage":
                return "revealDeletedMessage";
            case "undeleteMessage":
                return "undeleteMessage";
            case "retryMessage":
                return "retryMessage";
        }
    }

    function menuItemOnClickHandler(menuItemTitle: MenuItemTitle) {
        onOptionSelected?.();
        switch (menuItemTitle) {
            case "proposalCollapse":
                onCollapseMessage?.();
                break;
            case "followThread":
                followThread(true);
                break;
            case "unfollowThread":
                followThread(false);
                break;
            case "share":
                shareMessage();
                break;
            case "copyMessageUrl":
                copyMessageUrl();
                break;
            case "downloadMedia":
                if (mediaUrl) download(mediaUrl);
                break;
            case "copy":
                copyMessage();
                break;
            case "remindersMenu":
                onRemindMe();
                break;
            case "remindersCancel":
                cancelReminder();
                break;
            case "unpinMessage":
                unpinMessage();
                break;
            case "pinMessage":
                pinMessage();
                break;
            case "quoteReply":
                onReply();
                break;
            case "threadMenu":
                initiateThread();
                break;
            case "forward":
                forward();
                break;
            case "replyPrivately":
                onReplyPrivately();
                break;
            case "untranslateMessage":
                untranslateMessage();
                break;
            case "translateMessage":
                translateMessage();
                break;
            case "editMessage":
                onEditMessage();
                break;
            case "tipMenu":
                onTipMessage($lastCryptoSent ?? LEDGER_CANISTER_ICP);
                break;
            case "blockUser":
                blockUser();
                break;
            // Delete message options call the same handler
            case "deleteMessage":
            case "deleteMessageForMe":
                onDeleteMessage(!$confirmMessageDeletion);
                break;
            case "reportMenu":
                onReportMessage();
                break;
            case "revealDeletedMessage":
                revealDeletedMessage();
                break;
            case "undeleteMessage":
                undeleteMessage();
                break;
            case "retryMessage":
                onRetrySend?.();
                break;
        }
    }
</script>

{#snippet chooseIcon(title: MenuItemTitle, color?: string, size?: string)}
    {#if title === "proposalCollapse"}
        <CollapseIcon {size} {color} />
    {:else if title === "followThread"}
        <EyeArrowRightIcon {size} {color} />
    {:else if title === "unfollowThread"}
        <EyeOffIcon {size} {color} />
    {:else if title === "share"}
        <ShareIcon {size} {color} />
    {:else if title === "copyMessageUrl"}
        <VectorLink {size} {color} />
    {:else if title === "downloadMedia"}
        <Download {size} {color} />
    {:else if title === "copy"}
        <ContentCopy {size} {color} />
    {:else if title === "remindersMenu"}
        <ClockPlusOutline {size} {color} />
    {:else if title === "remindersCancel"}
        <ClockRemoveOutline {size} {color} />
    {:else if title === "unpinMessage"}
        <PinOff {color} {size} />
    {:else if title === "pinMessage"}
        <Pin {color} {size} />
    {:else if title === "quoteReply"}
        <Reply {color} {size} />
    {:else if title === "threadMenu"}
        <ChatPlusOutline {size} {color} />
    {:else if title === "forward"}
        <ShareOutline {color} {size} />
    {:else if title === "replyPrivately"}
        <ReplyOutline {color} {size} />
    {:else if title === "untranslateMessage"}
        <TranslateOff {color} {size} />
    {:else if title === "translateMessage"}
        <TranslateIcon {color} {size} />
    {:else if title === "editMessage"}
        <SquareEditOutline {color} {size} />
    {:else if title === "tipMenu"}
        <Bitcoin {color} {size} />
    {:else if title === "blockUser"}
        <Cancel {color} {size} />
    {:else if title === "deleteMessage"}
        <DeleteOutline {color} {size} />
    {:else if title === "deleteMessageForMe"}
        <DeleteOutline {color} {size} />
    {:else if title === "reportMenu"}
        <Flag {color} {size} />
    {:else if title === "revealDeletedMessage"}
        <EyeIcon {color} {size} />
    {:else if title === "undeleteMessage"}
        <DeleteOffOutline {color} {size} />
    {:else if title === "retryMessage"}
        <Refresh {color} {size} />
    {/if}
{/snippet}

{#snippet renderMenuItem(title: MenuItemTitle)}
    {@const danger = ["deleteMessage", "deleteMessageForMe", "reportMenu"].indexOf(title) > -1}
    {#if menuType === "icon_buttons"}
        {@const padding: Padding = ["sm", "sm"]}
        <IconButton size={iconButtonSize} {padding} onclick={() => menuItemOnClickHandler(title)}>
            {#snippet icon(color)}
                {@render chooseIcon(title, danger ? ColourVars.error : color)}
            {/snippet}
        </IconButton>
    {:else}
        {@const color = "var(--icon-inverted-txt)"}
        {@const size = $iconSize}
        <MenuItem {danger} onclick={() => menuItemOnClickHandler(title)}>
            {#snippet icon()}
                {@render chooseIcon(title, danger ? ColourVars.error : color, size)}
            {/snippet}
            <Translatable resourceKey={i18nKey(menuItemTitleToKey(title))} />
        </MenuItem>
    {/if}
{/snippet}

<!-- Proposal -->
{#if isProposal && !inert}
    {@render renderMenuItem("proposalCollapse")}
{/if}

<!-- Edit a messge -->
{#if canEdit && !inert && !failed}
    {@render renderMenuItem("editMessage")}
{/if}

<!-- Quote reply & Start thread -->
{#if confirmed && supportsReply && !inert && !failed}
    {#if canQuoteReply}
        {@render renderMenuItem("quoteReply")}
    {/if}
    {#if !inThread && canStartThread}
        {@render renderMenuItem("threadMenu")}
    {/if}
{/if}

<!-- Forward a message -->
{#if canForward && !inThread && !inert && !failed}
    {@render renderMenuItem("forward")}
{/if}

<!-- Copy message -->
{@render renderMenuItem("copy")}

{#if confirmed && !inert && !failed}
    <!-- Copy message URL -->
    {@render renderMenuItem("copyMessageUrl")}

    <!-- Share message -->
    {#if publicGroup && canShare}
        {@render renderMenuItem("share")}
    {/if}

    <!-- Follow message thread -->
    {#if canFollow}
        {@render renderMenuItem("followThread")}
    {:else if canUnfollow}
        {@render renderMenuItem("unfollowThread")}
    {/if}

    <!-- Download message media -->
    {#if mediaUrl !== undefined}
        {@render renderMenuItem("downloadMedia")}
    {/if}
{/if}

<!-- Set reminder -->
{#if canRemind && confirmed && !inert && !failed}
    {@render renderMenuItem("remindersMenu")}
{/if}

<!-- Cancel Reminder -->
{#if canCancelRemind && confirmed && !inert && !failed}
    {@render renderMenuItem("remindersCancel")}
{/if}

<!-- Pin & Un-pin a message -->
{#if confirmed && canPin && !inThread && !inert && !failed}
    {#if pinned}
        {@render renderMenuItem("unpinMessage")}
    {:else}
        {@render renderMenuItem("pinMessage")}
    {/if}
{/if}

<!-- Reply privately to a message -->
{#if confirmed && multiUserChat && !inThread && !me && !isProposal && !inert && !failed}
    {@render renderMenuItem("replyPrivately")}
{/if}

<!-- Translations -->
{#if !me && translatable && !failed}
    {#if translated}
        {@render renderMenuItem("untranslateMessage")}
    {:else}
        {@render renderMenuItem("translateMessage")}
    {/if}
{/if}

<!-- Tip sender -->
{#if canTip && !disableTipsFeature}
    {@render renderMenuItem("tipMenu")}
{/if}

<!-- Block sender -->
{#if confirmed && multiUserChat && !me && canBlockUser && !failed}
    {@render renderMenuItem("blockUser")}
{/if}

<!-- Retry message send -->
{#if failed}
    {@render renderMenuItem("retryMessage")}
{/if}

<!-- Delete message -->
{#if canDeleteMessage}
    {@render renderMenuItem(multiUserChat || me ? "deleteMessage" : "deleteMessageForMe")}
{/if}

<!-- Report message (moderation) -->
{#if confirmed && !me && !inert}
    {@render renderMenuItem("reportMenu")}
{/if}

<!-- Reveal deleted message -->
{#if canRevealDeleted || canRevealBlocked}
    {@render renderMenuItem("revealDeletedMessage")}
{/if}

<!-- Un-delete a message -->
{#if canUndelete}
    {@render renderMenuItem("undeleteMessage")}
{/if}

<script lang="ts">
    import { confirmMessageDeletion } from "@src/stores/settings";
    import { urlForMediaContent } from "@src/utils/media";
    import { ColourVars, IconButton, MenuItem, type Padding } from "component-lib";
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
        type ChatIdentifier,
        type Message,
        type MessageMenuAction,
        type MessageReminderCreatedContent,
        type OpenChat,
    } from "@client";
    import { translateMessage as translate } from "@src/logic/conversation/translateMessage";
    import { navigate } from "@utils/navigation";
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
    import ShareOutline from "svelte-material-icons/ShareOutline.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import SquareEditOutline from "svelte-material-icons/SquareEditOutline.svelte";
    import TranslateIcon from "svelte-material-icons/Translate.svelte";
    import TranslateOff from "svelte-material-icons/TranslateOff.svelte";
    import VectorLink from "svelte-material-icons/VectorLink.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import * as shareFunctions from "../../utils/share";
    import { copyToClipboard } from "../../utils/urls";
    import Bitcoin from "@shared_components/icons/Bitcoin.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { saveMediaToDevice } from "tauri-plugin-oc-api";
    import { getProxyAdjustedBlobUrl } from "../../utils/media";
    import { threadRootIndexFor } from "@src/logic/conversation/threadTimeline";

    const client = getContext<OpenChat>("client");

    type MenuType = "icon_buttons" | "menu_items";

    export interface Props {
        menuType?: MenuType;
        chatId: ChatIdentifier;
        confirmed: boolean;
        failed: boolean;
        inert: boolean;
        // what the menu offers (messageMenu)
        actions: ReadonlySet<MessageMenuAction>;
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
        confirmed,
        failed,
        inert,
        actions,
        msg,
        threadRootMessage,
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
    // the root, shown at the head of its thread, is the chat's message
    let threadRootMessageIndex = $derived(threadRootIndexFor(threadRootMessage, msg));

    function blockUser() {
        if (!actions.has("block_user") || chatId.kind !== "group_chat") return;
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

    // Simple MIME -> extension mapping - add more as required!
    const MIME_EXTENSION_MAP: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "video/mp4": "mp4",
        "video/webm": "webm",
        "audio/mpeg": "mp3",
        "audio/ogg": "ogg",
        "audio/wav": "wav",
        "application/pdf": "pdf",
    };

    function getExtensionFromMime(mime: string): string | null {
        return MIME_EXTENSION_MAP[mime] || null;
    }

    function getFilenameFromResponse(res: Response, url: string, mimeType: string): string {
        const disposition = res.headers.get("content-disposition");

        // Primary... try from content-disposition
        if (disposition) {
            // Try modern filename* (UTF-8)
            const utf8Match = /filename\*=UTF-8''(.+?)(?:;|$)/i.exec(disposition);
            if (utf8Match) {
                try {
                    return decodeURIComponent(utf8Match[1].trim());
                } catch {
                    // malformed encoding: fall back to the next way of finding a name
                }
            }

            // Try regular filename=
            const filenameMatch = /filename\s*=\s*["']?([^"';]+)["']?/i.exec(disposition);
            if (filenameMatch) {
                return filenameMatch[1].trim();
            }
        }

        // Fallback... extract from URL if available
        try {
            const urlObj = new URL(url);
            const filename = urlObj.pathname.split("/").pop()?.split("?")[0] || "";
            if (filename) return filename;
        } catch {
            // not a valid URL: use the default name below
        }

        // Default...
        const defaultName = `${msg.content.kind}_download_${Date.now()}`;
        const ext = getExtensionFromMime(mimeType);
        return ext ? `${defaultName}.${ext}` : defaultName;
    }

    type DownloadMeta = { mimeType: string; contentKind: "image" | "video" | "file" };

    function getDownloadMeta(res: Response): DownloadMeta | undefined {
        switch (msg.content.kind) {
            case "image_content":
                return { mimeType: msg.content.mimeType, contentKind: "image" };
            case "giphy_content":
                return { mimeType: "image/gif", contentKind: "image" };
            case "video_content":
                return { mimeType: msg.content.mimeType, contentKind: "video" };
            case "file_content":
                return { mimeType: msg.content.mimeType, contentKind: "file" };
            default: {
                const mime = res.headers.get("content-type")?.split(";")[0].trim();
                return mime ? { mimeType: mime, contentKind: "file" } : undefined;
            }
        }
    }

    async function download(urlArg: string) {
        try {
            const url = getProxyAdjustedBlobUrl(urlArg);

            if (!url) {
                throw new Error("Cannot download this content!");
            }

            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status} ${res.statusText}`);
            }

            const meta = getDownloadMeta(res);
            if (!meta) {
                throw new Error("Unknown download mime type or kind!");
            }
            const { mimeType, contentKind } = meta;
            const filename =
                msg.content.kind === "file_content"
                    ? msg.content.name
                    : getFilenameFromResponse(res, url, mimeType);

            if (client.isNativeApp()) {
                // This should work for a device, by using a tauri command
                // to save the file bytes to the correct location.
                await saveMediaToDevice({
                    kind: contentKind,
                    filename,
                    // TODO: sending raw bytes to rust may be memory heavy for
                    // large videos, since bytes get serialised via Tauri's IPC.
                    // Consider fetching from URL in Rust command!
                    data: new Uint8Array(await res.arrayBuffer()),
                    mimeType,
                });
            } else {
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = objectUrl;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(objectUrl);
            }

            // TODO expand this and show the path where the file was saved!
            toastStore.showSuccessToast(i18nKey("File downloaded!"));
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
        if (!actions.has("pin") || chatId.kind === "direct_chat") return;
        client.pinMessage(chatId, msg.messageIndex).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("pinMessageFailed"));
            }
        });
    }

    function unpinMessage() {
        if (!actions.has("unpin") || chatId.kind === "direct_chat") return;
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
        if (!actions.has("undelete")) return;
        client.undeleteMessage(chatId, threadRootMessageIndex, msg).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("undeleteMessageFailed"));
            }
        });
    }

    function revealDeletedMessage() {
        if (!actions.has("reveal")) return;
        if (msg.content.kind === "blocked_content") {
            client.revealBlockedMessage(msg.messageId);
        } else {
            client.revealDeletedMessage(chatId, msg.messageId, threadRootMessageIndex);
        }
    }

    function untranslateMessage() {
        client.untranslate(msg.messageId);
    }

    async function translateMessage() {
        const outcome = await translate(client, msg, {
            diamond: $isDiamondStore,
            locale: $locale,
        });
        if (outcome === "upgrade") {
            publish("upgrade");
        } else if (outcome === "failed") {
            toastStore.showFailureToast(i18nKey("unableToTranslate"));
        }
    }

    function followThread(follow: boolean) {
        if (!actions.has(follow ? "follow_thread" : "unfollow_thread")) {
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
        navigate(
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
                {@render chooseIcon(title, danger ? ColourVars.validationError : color)}
            {/snippet}
        </IconButton>
    {:else}
        {@const color = "var(--icon-inverted-txt)"}
        {@const size = $iconSize}
        <MenuItem {danger} onclick={() => menuItemOnClickHandler(title)}>
            {#snippet icon()}
                {@render chooseIcon(title, danger ? ColourVars.validationError : color, size)}
            {/snippet}
            <Translatable resourceKey={i18nKey(menuItemTitleToKey(title))} />
        </MenuItem>
    {/if}
{/snippet}

<!-- Proposal -->
{#if actions.has("collapse_proposal")}
    {@render renderMenuItem("proposalCollapse")}
{/if}

<!-- Edit a messge -->
{#if actions.has("edit")}
    {@render renderMenuItem("editMessage")}
{/if}

<!-- Quote reply & Start thread -->
{#if actions.has("reply")}
    {@render renderMenuItem("quoteReply")}
{/if}
{#if actions.has("start_thread")}
    {@render renderMenuItem("threadMenu")}
{/if}

<!-- Forward a message -->
{#if actions.has("forward")}
    {@render renderMenuItem("forward")}
{/if}

<!-- Copy message -->
{#if actions.has("copy")}
    {@render renderMenuItem("copy")}
{/if}

<!-- Copy message URL -->
{#if actions.has("copy_url")}
    {@render renderMenuItem("copyMessageUrl")}
{/if}

<!-- Share message -->
{#if actions.has("share")}
    {@render renderMenuItem("share")}
{/if}

<!-- Follow message thread -->
{#if actions.has("follow_thread")}
    {@render renderMenuItem("followThread")}
{:else if actions.has("unfollow_thread")}
    {@render renderMenuItem("unfollowThread")}
{/if}

<!-- Download message media (mobile only) -->
{#if confirmed && !inert && !failed && mediaUrl !== undefined}
    {@render renderMenuItem("downloadMedia")}
{/if}

<!-- Set reminder -->
{#if actions.has("remind")}
    {@render renderMenuItem("remindersMenu")}
{/if}

<!-- Cancel Reminder -->
{#if actions.has("cancel_reminder")}
    {@render renderMenuItem("remindersCancel")}
{/if}

<!-- Pin & Un-pin a message -->
{#if actions.has("unpin")}
    {@render renderMenuItem("unpinMessage")}
{:else if actions.has("pin")}
    {@render renderMenuItem("pinMessage")}
{/if}

<!-- Reply privately to a message -->
{#if actions.has("reply_privately")}
    {@render renderMenuItem("replyPrivately")}
{/if}

<!-- Translations -->
{#if actions.has("untranslate")}
    {@render renderMenuItem("untranslateMessage")}
{:else if actions.has("translate")}
    {@render renderMenuItem("translateMessage")}
{/if}

<!-- Tip sender -->
{#if actions.has("tip")}
    {@render renderMenuItem("tipMenu")}
{/if}

<!-- Block sender -->
{#if actions.has("block_user")}
    {@render renderMenuItem("blockUser")}
{/if}

<!-- Retry message send -->
{#if actions.has("retry")}
    {@render renderMenuItem("retryMessage")}
{/if}

<!-- Delete message -->
{#if actions.has("delete")}
    {@render renderMenuItem("deleteMessage")}
{:else if actions.has("delete_for_me")}
    {@render renderMenuItem("deleteMessageForMe")}
{/if}

<!-- Report message (moderation) -->
{#if actions.has("report")}
    {@render renderMenuItem("reportMenu")}
{/if}

<!-- Reveal deleted message -->
{#if actions.has("reveal")}
    {@render renderMenuItem("revealDeletedMessage")}
{/if}

<!-- Un-delete a message -->
{#if actions.has("undelete")}
    {@render renderMenuItem("undeleteMessage")}
{/if}

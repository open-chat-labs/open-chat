<!-- A message's long-press menu and what it opens (native design notes §3.3): the kit's
     MessageLongPressMenu (the quick reactions, then Reply, Forward, Copy, Info, Edit … and, after the
     divider, Delete, Report), the emoji sheet behind the reactions' + (ReactionPicker: the
     composer's emoji panel's emoji), the forward sheet, the report sheet, and the alert offering
     Diamond for a translation. What each action does is the shared `messageAction`
     (logic/conversation, the web's too); here is how it's shown: toasts (a delete with Undo, which
     restores it, after a native confirm while "ask before deleting" is on; a pin's and an unpin's
     with Undo: pinToasts), the sheets, Info pushed
     over the conversation. Opening the menu plays the one haptic a long-press gives (medium; the
     chat's MessageGroup plays none of its own). Reply and Edit set the chat's draft, which the
     composer shows. The conversation opens it with `open`. -->
<script lang="ts">
    import {
        allUsersStore,
        chatIdentifierToString,
        currentUserIdStore,
        i18nKey,
        isDiamondStore,
        routeForChatIdentifier,
        type ChatIdentifier,
        type ChatSummary,
        type EventWrapper,
        type Message,
        type MessageMenu as MessageOffer,
        type MessageMenuAction,
        type OpenChat,
        type ReportReason,
    } from "@client";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import { haptic } from "@openchat/ui/src/native/haptics";
    import MessageLongPressMenu from "@openchat/ui/src/native/MessageLongPressMenu.svelte";
    import NativeAlert from "@openchat/ui/src/native/NativeAlert.svelte";
    import { interpolate } from "@src/i18n/i18n";
    import {
        messageAction,
        undeleteMessage,
        type MessageActionOutcome,
        type MessageActionTarget,
    } from "@src/logic/conversation/messageAction";
    import { removeLinkPreview } from "@src/logic/conversation/linkPreview";
    import { toggleReaction } from "@src/logic/conversation/reaction";
    import { quickReactions as recentReactions } from "@src/stores/quickReactions";
    import { confirmMessageDeletion } from "@src/stores/settings";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { getContext, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import { softKeyboard } from "../../aboveKeyboard.svelte";
    import { DIAMOND_URL } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenContext } from "../app/screens";
    import ForwardSheet from "./ForwardSheet.svelte";
    import { pinWithUndo, unpinWithUndo } from "./pinToasts";
    import {
        messageMenuItems,
        myReactions,
        nativeMessageAction,
        quickReactions,
    } from "./messageMenu.adapter";
    import ReactionPicker from "./ReactionPicker.svelte";
    import ReportSheet from "./ReportSheet.svelte";

    type Props = {
        /** The conversation's chat. */
        chat: ChatSummary | undefined;
        context: ScreenContext;
    };

    let { chat, context }: Props = $props();

    const client = getContext<OpenChat>("client");
    // the shell's, the same for the screen's life
    const overlays = untrack(() => context.overlays);
    const me = $derived($currentUserIdStore);

    type DeleteAction = "delete" | "delete_for_me";

    // the message whose menu is open (or was, while it fades), and what it offers
    type Pressed = {
        chatId: ChatIdentifier;
        evt: EventWrapper<Message>;
        el: HTMLElement;
        offered: MessageOffer;
        failed: boolean;
        side: "received" | "sent";
    };
    let pressed = $state<Pressed>();
    let menuOpen = $state(false);
    // what the menu opened: the emoji sheet, the forward and report sheets, Diamond's alert
    let picking = $state<Pressed>();
    let forwarding = $state<{ chatId: ChatIdentifier; message: Message }>();
    let reporting = $state<Pressed>();
    let upgrading = $state(false);
    // a sent message's delete, waiting on the sender's confirm ("ask before deleting")
    let deleting = $state<{ at: Pressed; action: DeleteAction }>();
    // its "Don't ask again", kept once the delete is confirmed (the web's toggle, the same setting)
    let dontAskAgain = $state(false);
    // a link's preview the sender asked to take off, waiting on their confirm
    let removing = $state<{ chatId: ChatIdentifier; evt: EventWrapper<Message>; url: string }>();

    /** Opens the message's menu over it (`el`, its row), offering what `offered` says. */
    export function open(
        evt: EventWrapper<Message>,
        el: HTMLElement | undefined,
        offered: MessageOffer,
        failed: boolean,
    ): void {
        if (chat === undefined || el === undefined || !offered.menu) return;
        // the long-press's one haptic (the chat's MessageGroup plays none); once, should a press
        // open the menu twice (Android's own long-press, then the group's)
        if (!menuOpen) haptic("medium");
        clearSelectionIn(el);
        pressed = {
            chatId: chat.id,
            evt,
            el,
            offered,
            failed,
            side: evt.event.sender === me ? "sent" : "received",
        };
        menuOpen = true;
    }

    // the messages can't be selected (ConversationScreen's styles), but should a selection have
    // started in this one anyway (the platform's long-press), it goes: the menu has Copy
    function clearSelectionIn(el: HTMLElement) {
        const selection = window.getSelection();
        if (selection !== null && !selection.isCollapsed && selection.containsNode(el, true)) {
            selection.removeAllRanges();
        }
    }

    /** Asks the sender to confirm taking the link's preview off their message (notes §1: a small alert). */
    export function removePreview(evt: EventWrapper<Message>, url: string): void {
        if (chat !== undefined) removing = { chatId: chat.id, evt, url };
    }

    // another chat takes this one's place: what was open on its messages closes. Keyed on the
    // chat's id as a string: the summary is a new object on every update to it (a message in, an
    // unread count), which isn't another chat
    const chatKey = $derived(chat && chatIdentifierToString(chat.id));
    $effect.pre(() => {
        void chatKey;
        untrack(() => {
            menuOpen = false;
            picking = undefined;
            reporting = undefined;
            deleting = undefined;
            removing = undefined;
        });
    });

    useOverlay(
        overlays,
        () => menuOpen,
        () => (menuOpen = false),
    );
    useOverlay(
        overlays,
        () => picking !== undefined,
        () => (picking = undefined),
    );
    useOverlay(
        overlays,
        () => forwarding !== undefined,
        () => (forwarding = undefined),
    );
    useOverlay(
        overlays,
        () => reporting !== undefined,
        () => (reporting = undefined),
    );
    useOverlay(
        overlays,
        () => upgrading,
        () => (upgrading = false),
    );
    useOverlay(
        overlays,
        () => deleting !== undefined,
        () => (deleting = undefined),
    );
    useOverlay(
        overlays,
        () => removing !== undefined,
        () => (removing = undefined),
    );

    async function confirmRemovePreview() {
        const at = removing;
        removing = undefined;
        if (at === undefined) return;
        const failure = await removeLinkPreview(client, { chatId: at.chatId }, at.evt, at.url);
        if (failure !== undefined) toastStore.showFailureToast(failure);
    }

    const items = $derived(
        pressed === undefined
            ? []
            : messageMenuItems(pressed.offered.actions, !pressed.offered.inert, (key) => $_(key)),
    );
    const reactions = $derived(
        pressed?.offered.react ? quickReactions($recentReactions) : [],
    );
    const mine = $derived(pressed === undefined ? [] : myReactions(pressed.evt.event.reactions, me));

    function react(at: Pressed, emoji: string) {
        void toggleReaction(client, { chatId: at.chatId }, at.evt.event, emoji);
    }

    function target(at: Pressed, confirmDelete: boolean): MessageActionTarget {
        return {
            client,
            context: { chatId: at.chatId },
            evt: at.evt,
            failed: at.failed,
            me,
            users: $allUsersStore,
            formatter: $_,
            locale: $locale,
            diamond: $isDiamondStore,
            confirmDelete,
        };
    }

    async function select(id: string) {
        const at = pressed;
        const action = nativeMessageAction(id);
        if (at === undefined || action === undefined) return;
        if (action === "info") {
            context.push({
                kind: "message_info",
                chatId: at.chatId,
                messageId: at.evt.event.messageId,
            });
            return;
        }
        // a pin and an unpin offer Undo (plan 04): an unpin is only sent once its Undo has gone
        if ((action === "pin" || action === "unpin") && at.chatId.kind !== "direct_chat") {
            const index = at.evt.event.messageIndex;
            if (action === "pin") {
                void pinWithUndo(client, context, at.chatId, index, {
                    pinned: $_("native.conversation.message.pinned"),
                    unpinning: $_("native.conversation.pinned.unpinning"),
                    unpinned: $_("native.conversation.message.unpinned"),
                });
            } else {
                unpinWithUndo(
                    client,
                    context,
                    at.chatId,
                    chatIdentifierToString(at.chatId),
                    [index],
                    $_("native.conversation.message.unpinned"),
                );
            }
            return;
        }
        // a sent message's delete puts its toast up before the backend has it (deleteWithUndo),
        // unless it asks first: then messageAction says so and show() asks
        const confirmDelete = $confirmMessageDeletion;
        if (isDelete(action) && !at.failed && !confirmDelete) {
            await deleteWithUndo(at, action);
            return;
        }
        show(at, action, await messageAction(action, target(at, confirmDelete)));
    }

    function isDelete(action: MessageMenuAction): action is DeleteAction {
        return action === "delete" || action === "delete_for_me";
    }

    // what came of an action, shown
    function show(at: Pressed, action: MessageMenuAction, outcome: MessageActionOutcome) {
        switch (outcome.kind) {
            case "ask":
                if (outcome.dialog.kind === "forward") {
                    forwarding = { chatId: at.chatId, message: outcome.dialog.evt.event };
                } else if (outcome.dialog.kind === "report") {
                    reporting = at;
                } else if (outcome.dialog.kind === "delete" && isDelete(action)) {
                    deleting = { at, action };
                    dontAskAgain = false;
                }
                return;
            case "succeeded":
                context.toast(interpolate($_, outcome.message));
                return;
            case "failed":
                toastStore.showFailureToast(outcome.message);
                return;
            case "copied":
                if (outcome.ok) context.toast($_("native.conversation.message.copied"));
                else toastStore.showFailureToast(i18nKey("native.conversation.message.copyFailed"));
                return;
            case "link_copied":
                if (outcome.ok) context.toast($_("linkCopiedToClipboard"));
                else {
                    toastStore.showFailureToast(
                        i18nKey("failedToCopyUrlToClipboard", { url: outcome.url }),
                    );
                }
                return;
            case "shared":
                if (!outcome.ok) toastStore.showFailureToast(i18nKey("failedToShareMessage"));
                return;
            case "open_chat":
                navigate(routeForChatIdentifier("chats", outcome.chatId));
                return;
            case "not_found":
                toastStore.showFailureToast(
                    i18nKey("native.conversation.message.privateReplyFailed"),
                );
                return;
            case "upgrade":
                upgrading = true;
                return;
            case "done":
                if (action === "undelete") {
                    context.toast($_("native.conversation.message.restored"));
                }
                return;
            // a delete is deleteWithUndo's; threads aren't offered here (N8a)
            case "deleted":
            case "open_thread":
                return;
        }
    }

    // a delete shows at once; its toast waits for the backend, then offers Undo, which restores it
    // (notes §1: destructive actions show Undo). With "ask before deleting" on, only once confirmed.
    async function deleteWithUndo(at: Pressed, action: DeleteAction) {
        const pending = context.pendingToast($_("native.conversation.message.deleting"));
        const outcome = await messageAction(action, target(at, false));
        if (outcome.kind !== "deleted" || !outcome.ok) {
            pending.failed();
            toastStore.showFailureToast(i18nKey("native.conversation.message.deleteFailed"));
            return;
        }
        const restoring = $_("native.conversation.message.restoring");
        const restored = $_("native.conversation.message.restored");
        pending.done({
            message: $_("native.conversation.message.deleted"),
            undo: {
                pending: restoring,
                run: async () => {
                    if (await undeleteMessage(client, { chatId: at.chatId }, at.evt.event)) {
                        return restored;
                    }
                    toastStore.showFailureToast(i18nKey("undeleteMessageFailed"));
                    return undefined;
                },
            },
        });
    }

    // forwarded to each chat picked, without opening them: the toast waits until they all have it
    async function forward(message: Message, chatIds: ChatIdentifier[], note: string) {
        const count = chatIds.length;
        const pending = context.pendingToast(
            $_("native.conversation.forward.forwarding", { values: { count } }),
        );
        const outcome = await client.forwardMessageToChats(chatIds, message, note);
        switch (outcome.kind) {
            case "forwarded":
                pending.done({
                    message: $_("native.conversation.forward.forwarded", { values: { count } }),
                });
                return;
            case "throttled":
                pending.failed();
                toastStore.showFailureToast(i18nKey("native.conversation.forward.throttled"));
                return;
            case "failed":
                pending.failed();
                toastStore.showFailureToast(i18nKey("native.conversation.forward.failed"));
                return;
        }
    }

    async function report(at: Pressed, reason: ReportReason, deleteToo: boolean) {
        const pending = context.pendingToast($_("native.conversation.report.reporting"));
        const reported = await client.reportMessage(
            at.chatId,
            undefined,
            at.evt.event.messageId,
            deleteToo,
            reason,
        );
        if (reported) {
            pending.done({ message: $_("native.conversation.report.reported") });
        } else {
            pending.failed();
            toastStore.showFailureToast(i18nKey("report.failure"));
        }
    }
</script>

<MessageLongPressMenu
    open={menuOpen}
    target={pressed?.el ?? null}
    side={pressed?.side ?? "received"}
    {items}
    label={$_("native.conversation.message.options")}
    {reactions}
    selected={mine}
    onReact={(emoji) => pressed !== undefined && react(pressed, emoji)}
    onMoreReactions={() => (picking = pressed)}
    onSelect={(id) => void select(id)}
    onClose={() => (menuOpen = false)} />

<BottomSheet
    open={picking !== undefined}
    onClose={() => (picking = undefined)}
    label={$_("native.conversation.message.react")}
    height="72%"
    keyboard={softKeyboard.covering}>
    <ReactionPicker
        userId={me}
        selected={picking === undefined ? [] : myReactions(picking.evt.event.reactions, me)}
        onPick={(emoji) => {
            const at = picking;
            picking = undefined;
            if (at !== undefined) react(at, emoji);
        }} />
</BottomSheet>

<ForwardSheet
    message={forwarding?.message}
    from={forwarding?.chatId}
    onClose={() => (forwarding = undefined)}
    onForward={(chatIds, note) => {
        const message = forwarding?.message;
        if (message !== undefined) void forward(message, chatIds, note);
    }} />

<ReportSheet
    open={reporting !== undefined}
    canDelete={reporting !== undefined && client.canDeleteOtherUsersMessages(reporting.chatId)}
    onClose={() => (reporting = undefined)}
    onReport={(reason, deleteToo) => {
        const at = reporting;
        if (at !== undefined) void report(at, reason, deleteToo);
    }} />

<NativeAlert
    open={deleting !== undefined}
    title={$_("deleteMessageConfirm")}
    confirmLabel={$_("deleteMessage")}
    danger
    checkLabel={$_("install.dontShow")}
    checked={dontAskAgain}
    onCheck={(on) => (dontAskAgain = on)}
    onConfirm={() => {
        const confirmed = deleting;
        deleting = undefined;
        if (dontAskAgain) confirmMessageDeletion.set(false);
        if (confirmed !== undefined) void deleteWithUndo(confirmed.at, confirmed.action);
    }}
    onClose={() => (deleting = undefined)} />

<NativeAlert
    open={removing !== undefined}
    title={$_("removePreviewQuestion")}
    confirmLabel={$_("remove")}
    danger
    onConfirm={() => void confirmRemovePreview()}
    onClose={() => (removing = undefined)} />

<NativeAlert
    open={upgrading}
    title={$_("native.conversation.message.translateTitle")}
    message={$_("native.conversation.message.translateDiamond")}
    confirmLabel={$_("native.conversation.message.getDiamond")}
    onConfirm={() => {
        upgrading = false;
        navigate(DIAMOND_URL);
    }}
    onClose={() => (upgrading = false)} />

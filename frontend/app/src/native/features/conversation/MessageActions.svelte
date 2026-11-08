<!-- A message's long-press menu and what it opens (native design notes §3.3): the kit's
     MessageLongPressMenu (the quick reactions, then Reply, Forward, Copy, Info, Edit … and, after the
     divider, Delete, Report), the emoji sheet behind the reactions' +, the forward sheet, the report
     sheet, and the alert offering Diamond for a translation. What each action does is the shared
     `messageAction` (logic/conversation, the web's too); here is how it's shown: toasts (a delete
     with Undo, which restores it), the sheets, Info pushed over the conversation. Reply and Edit set
     the chat's draft, which the composer shows. The conversation opens it with `open`. -->
<script lang="ts">
    import {
        allUsersStore,
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
    import EmojiPicker from "@openchat/ui/src/lib/components/EmojiPicker.svelte";
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
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { getContext, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import { DIAMOND_URL } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenContext } from "../app/screens";
    import ForwardSheet from "./ForwardSheet.svelte";
    import {
        messageMenuItems,
        myReactions,
        nativeMessageAction,
        quickReactions,
    } from "./messageMenu.adapter";
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
        pressed = {
            chatId: chat.id,
            evt,
            el,
            offered,
            failed,
            side: evt.event.sender === me ? "sent" : "received",
        };
        menuOpen = true;
        haptic("light");
    }

    /** Asks the sender to confirm taking the link's preview off their message (notes §1: a small alert). */
    export function removePreview(evt: EventWrapper<Message>, url: string): void {
        if (chat !== undefined) removing = { chatId: chat.id, evt, url };
    }

    // another chat takes this one's place: what was open on its messages closes
    $effect.pre(() => {
        void chat?.id;
        untrack(() => {
            menuOpen = false;
            picking = undefined;
            reporting = undefined;
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

    function target(at: Pressed): MessageActionTarget {
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
            // a delete offers Undo rather than asking first (notes §1)
            confirmDelete: false,
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
        if ((action === "delete" || action === "delete_for_me") && !at.failed) {
            await deleteWithUndo(at, action);
            return;
        }
        show(at, action, await messageAction(action, target(at)));
    }

    // what came of an action, shown
    function show(at: Pressed, action: MessageMenuAction, outcome: MessageActionOutcome) {
        switch (outcome.kind) {
            case "ask":
                if (outcome.dialog.kind === "forward") {
                    forwarding = { chatId: at.chatId, message: outcome.dialog.evt.event };
                } else if (outcome.dialog.kind === "report") {
                    reporting = at;
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
                if (action === "pin") context.toast($_("native.conversation.message.pinned"));
                if (action === "unpin") context.toast($_("native.conversation.message.unpinned"));
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
    // (notes §1: destructive actions show Undo, rather than asking first)
    async function deleteWithUndo(at: Pressed, action: "delete" | "delete_for_me") {
        const pending = context.pendingToast($_("native.conversation.message.deleting"));
        const outcome = await messageAction(action, target(at));
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
        if (await client.forwardMessageToChats(chatIds, message, note)) {
            pending.done({
                message: $_("native.conversation.forward.forwarded", { values: { count } }),
            });
        } else {
            pending.failed();
            toastStore.showFailureToast(i18nKey("native.conversation.forward.failed"));
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
    height="72%">
    <div class="picker">
        <EmojiPicker
            recent={$recentReactions}
            selected={picking === undefined ? [] : myReactions(picking.evt.event.reactions, me)}
            autoFocus={false}
            onPick={(emoji) => {
                const at = picking;
                picking = undefined;
                if (at !== undefined) react(at, emoji);
            }}
            onClose={() => (picking = undefined)} />
    </div>
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

<style lang="scss">
    // the picker fills the sheet, its grid scrolling under its search
    .picker {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        padding: 0 var(--space-8);

        > :global(*) {
            flex: 1;
            min-height: 0;
        }
    }
</style>

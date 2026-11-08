<!-- A conversation's composer (native design notes §3.3): the library's MessageComposer as a pill, its
     + and emoji buttons in the platform's order (§2), opening the attach and emoji panels in the
     keyboard's place (the slot under it, KeyboardSlot), with the chat's draft (its text, the reply
     or edit a swipe set, a photo, video or file attached), @mentions, a voice message, and the
     notice over it (the throttle, a video being prepared); where the reader can't send, the old
     footer's reason instead. Its operations are the shared ones the web's composer uses
     (logic/composer, logic/conversation/draftActions, the client's sends). A part of the
     conversation screen, as the web's MessageArea is, so a thread's screen (N8a) can take it too:
     `context` is where it sends. Keyed by chat by its host, so it starts from that chat's draft. -->
<script lang="ts">
    import {
        allUsersStore,
        anonUserStore,
        audioRecordingMimeType,
        blockedUsersStore,
        currentUserIdStore,
        isDiamondStore,
        localUpdates,
        maxMediaSizes,
        messageContextsEqual,
        messagePermissionsForSelectedChatStore,
        selectedChatDraftMessageStore,
        selectedChatMembersStore,
        selectedCommunityMembersStore,
        selectedCommunitySummaryStore,
        selectedCommunityUserGroupsStore,
        suspendedUserStore,
        throttleDeadline,
        videoProcessingProgress,
        type ChatSummary,
        type GiphyContent,
        type MessageContext,
        type OpenChat,
    } from "@client";
    import { interpolate } from "@i18n/i18n";
    import Banner from "@openchat/ui/src/lib/components/Banner.svelte";
    import MessageComposer from "@openchat/ui/src/lib/components/MessageComposer.svelte";
    import {
        attachRefusal,
        canAttachNow,
        canRecordVoice,
        chatEntryState,
        composerBuilders,
        draftAttachment,
        editStartText,
        entryBlock,
        entryBlockBanner,
        entryNotice,
        entryNoticeText,
        entryPlaceholder,
        MemberFinder,
        mentionsFor,
        pickableAttachments,
        sendComposed,
        sendVoiceRecording,
        throttleCountdown,
        TypingNotifier,
        type ComposerBuilder,
    } from "@src/logic/composer/composer";
    import {
        composerAttachment,
        composerContext,
        composerMention,
        composerStartText,
    } from "@src/logic/composer/composerProps";
    import {
        cancelComposing,
        composingMessageIndex,
        submitEdit,
    } from "@src/logic/conversation/draftActions";
    import type { ConversationContext } from "@src/logic/conversation/messageRow";
    import { enterSend } from "@src/stores/settings";
    import { now500 } from "@src/stores/time";
    import { fileFromDataTransferItems } from "@src/utils/datatransfer";
    import { composerBuildersOff } from "@src/utils/features";
    import { microphoneDenied } from "@src/utils/media";
    import { getContext, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeOs } from "../../platform";
    import AttachPanel from "./AttachPanel.svelte";
    import EmojiPanel from "./EmojiPanel.svelte";
    import { composerPlacement, type Panel } from "./keyboardSlot";
    import type { KeyboardSlot } from "./keyboardSlot.svelte";

    type Props = {
        /** The chat (the selected one). */
        chat: ChatSummary;
        /** The rows' context, for the reply or edit strip's names and text. */
        ctx: ConversationContext;
        slot: KeyboardSlot;
        os: NativeOs;
        /** In the apps, the attach panel's gallery strip (Camera, All photos); not on mobile web. */
        gallery: boolean;
        /** Says something went wrong (the native toast). */
        toast: (message: string) => void;
        /** A builder picked from the attach panel (a poll, a prize …). */
        onBuild: (builder: ComposerBuilder) => void;
        /** Goes to a message in the list (the one replied to or edited). */
        onJump: (index: number) => void;
    };

    let { chat, ctx, slot, os, gallery, toast, onBuild, onJump }: Props = $props();

    const client = getContext<OpenChat>("client");

    const me = $derived($currentUserIdStore);
    // where it sends: the chat (a thread's composer, N8a, sends to the thread)
    const context = $derived<MessageContext>({ chatId: chat.id });
    const permitted = $derived($messagePermissionsForSelectedChatStore);

    // why the reader can't send here, in the old footer's words
    const block = $derived(
        entryBlock(
            chatEntryState(client, chat, false, {
                suspended: $suspendedUserStore,
                anonymous: $anonUserStore,
                blockedUsers: $blockedUsersStore,
                community: $selectedCommunitySummaryStore,
            }),
        ),
    );
    const blocked = $derived(block === undefined ? undefined : entryBlockBanner(block));

    // the panels go when the composer does
    $effect(() => {
        if (blocked !== undefined) untrack(() => slot.close());
    });

    // the throttle's countdown (the clock only ticks once there's a deadline), else a video picked
    // here being prepared
    const countdown = $derived(
        $throttleDeadline > 0 ? throttleCountdown($throttleDeadline, $now500) : undefined,
    );
    const notice = $derived.by(() => {
        const progress = $videoProcessingProgress;
        const shown = entryNotice({
            throttledSeconds: countdown?.seconds,
            videoProgress:
                progress !== undefined && messageContextsEqual(progress.context, context)
                    ? progress.progress
                    : undefined,
        });
        if (shown === undefined) return undefined;
        const words = entryNoticeText(shown);
        return { text: interpolate($_, words.key), tone: words.tone };
    });

    // the chat's draft: its text, the reply or edit (an edit starts from the message's text with its
    // mentions as typed), and what's attached (a photo, video or file; a builder's payment is N9's)
    const draft = $derived($selectedChatDraftMessageStore);
    const composing = $derived(
        composerContext(
            draft,
            ctx,
            draft?.editingEvent === undefined
                ? undefined
                : editStartText(
                      draft.editingEvent.event.content,
                      $allUsersStore,
                      $selectedCommunityUserGroupsStore,
                  ),
        ),
    );
    const staged = $derived(composerAttachment(draftAttachment(draft), ctx));
    const composingIndex = $derived(composingMessageIndex(draft, context));

    // a direct chat with a bot takes text only (its direct-message command)
    const directBot = $derived(client.directChatWithBot(chat) !== undefined);

    // nothing is attached during an edit, or while a voice message is recorded or reviewed
    let voiceActive = $state(false);
    const attachable = $derived(
        !directBot && canAttachNow({ editing: draft?.editingEvent !== undefined, voiceActive }),
    );
    const pickable = $derived(attachable ? pickableAttachments(permitted) : []);
    const builders = $derived(
        attachable ? composerBuilders(permitted, composerBuildersOff) : [],
    );
    // GIFs where they may be sent, as the old composer's (none in a bot's DM)
    const gifs = $derived(!directBot && permitted.has("giphy"));

    // the + opens the attach panel while there's something to attach
    const canPlus = $derived(pickable.length > 0 || builders.length > 0);
    $effect(() => {
        if (!canPlus && slot.panel === "attach") untrack(() => slot.close());
    });

    const placeholder = $derived(
        interpolate($_, entryPlaceholder({ canEnterText: true, attached: false, directBot })),
    );

    // a voice message, recorded in a format every device plays, where the reader may send one
    const voiceMimeType =
        typeof MediaRecorder === "undefined" ? undefined : audioRecordingMimeType();
    let micDenied = $state(false);
    onMount(async () => {
        micDenied = await microphoneDenied();
    });
    const canRecord = $derived(
        canRecordVoice({
            audioPermitted: permitted.has("audio"),
            recorderMimeType: voiceMimeType,
            micDenied,
            directBot,
        }),
    );
    const voiceMaxBytes = $derived(maxMediaSizes($isDiamondStore).audio);

    async function sendVoice(recording: Blob, mimeType: string) {
        const sent = await sendVoiceRecording(client, context, recording, mimeType);
        if (sent.kind !== "posted") throw new Error(sent.reason);
    }

    // @mentions: who in this chat is offered for the "@word" being typed, and those it doesn't
    // hold looked for once two characters are typed
    let mentionQuery = $state<string>();
    const memberFinder = new MemberFinder((prefix) => client.findMembersToMention(prefix));
    $effect(() => () => memberFinder.cancel());

    function mentionQueried(query: string | undefined) {
        mentionQuery = query;
        memberFinder.typed(query);
    }

    const mentions = $derived.by(() => {
        if (mentionQuery === undefined) return [];
        // what the lookup reads through `.value`: it changes as members not held are found
        void [$selectedChatMembersStore, $selectedCommunityMembersStore, $allUsersStore];
        return mentionsFor(client, mentionQuery, me).map((candidate) =>
            composerMention(candidate, (user) => client.userAvatarUrl(user)),
        );
    });
    // the others hear while the reader types; leaving, their "typing" runs out by itself
    const typing = new TypingNotifier(
        () => client.startTyping(chat.id, me, undefined),
        () => client.stopTyping(chat.id, me, undefined),
    );
    $effect(() => () => typing.cancel());

    function onInput(text: string) {
        // an empty or blank draft is no draft
        localUpdates.draftMessages.setTextContent(
            context,
            text.trim() === "" ? undefined : text,
        );
        typing.input(text);
    }

    // done once the message shows; refused, it rejects and the composer keeps the draft
    async function send(text: string): Promise<void> {
        typing.stopped();
        const sent = await sendComposed(client, chat, context, text, {
            content: draftAttachment(draft),
            shown: staged !== null,
        });
        if (sent.kind !== "posted") throw new Error(sent.reason);
    }

    async function saveEdit(text: string) {
        if (!(await submitEdit(client, context, draft, text))) {
            toast($_("errorEditingMessage"));
        }
    }

    // a file picked, pasted or taken goes to the draft, if it may be sent here
    async function attachFile(file: File) {
        const outcome = await client.attachFile(file, context);
        if (outcome.kind !== "attached") toast(interpolate($_, attachRefusal(outcome, $_)));
    }

    function paste(e: ClipboardEvent) {
        if (!attachable || e.clipboardData === null) return;
        const file = fileFromDataTransferItems([...e.clipboardData.items]);
        if (file === undefined) return;
        e.preventDefault();
        void attachFile(file);
    }

    // ---- the panels in the keyboard's place

    let composer: MessageComposer | undefined = $state();
    const placement = $derived(composerPlacement(os));

    function toggle(panel: Panel) {
        switch (slot.toggle(panel)) {
            case "blur":
                // the keyboard goes down as the panel takes its place
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                break;
            case "focus":
                composer?.focus();
                break;
        }
    }

    // the emoji panel types into the draft without focusing it (no keyboard): "\b" deletes
    let inserted = $state<{ key: number; text: string }>();
    function insert(text: string) {
        inserted = { key: (inserted?.key ?? 0) + 1, text };
    }

    // a GIF is sent as it's tapped, as a reply to the draft's reply
    function sendGif(content: GiphyContent) {
        void client.sendMessageWithContent(context, content, false);
    }

    // the attach panel's pickers: photos and videos, the camera, any file
    let mediaInput = $state<HTMLInputElement>();
    let cameraInput = $state<HTMLInputElement>();
    let fileInput = $state<HTMLInputElement>();

    function pick(kind: "media" | "camera" | "file") {
        slot.close();
        if (kind === "media") mediaInput?.click();
        else if (kind === "camera") cameraInput?.click();
        else fileInput?.click();
    }

    function build(builder: ComposerBuilder) {
        slot.close();
        onBuild(builder);
    }

    function picked(e: { currentTarget: HTMLInputElement }) {
        const file = e.currentTarget.files?.[0];
        // so picking the same file again is a change too
        e.currentTarget.value = "";
        if (file !== undefined) void attachFile(file);
    }
</script>

{#if blocked !== undefined}
    <div class="blocked">
        <Banner tone={blocked.tone} text={$_(blocked.key)} />
    </div>
{:else}
    {#if notice !== undefined}
        <div class="notice">
            <Banner tone={notice.tone} text={notice.text} />
        </div>
    {/if}
    <!-- only there to hear a paste: lays nothing out -->
    <div class="pill" onpaste={paste}>
        <MessageComposer
            bind:this={composer}
            text={composerStartText(draft)}
            {placeholder}
            enterSends={$enterSend}
            {onInput}
            onSend={send}
            context={composing}
            onCancelContext={() => cancelComposing(context, draft)}
            onSubmitEdit={saveEdit}
            onJumpContext={composingIndex === undefined ? undefined : () => onJump(composingIndex)}
            attachment={staged}
            onRemoveAttachment={() => localUpdates.draftMessages.setAttachment(context, undefined)}
            onRemoveMediaItem={() => localUpdates.draftMessages.setAttachment(context, undefined)}
            onVoice={canRecord && voiceMimeType !== undefined
                ? ({ blob }) => sendVoice(blob, voiceMimeType)
                : undefined}
            {voiceMimeType}
            {voiceMaxBytes}
            onVoiceActive={(active) => (voiceActive = active)}
            onMentionQuery={mentionQueried}
            {mentions}
            plusPlacement={placement.plus}
            emojiPlacement={placement.emoji}
            onPlus={canPlus ? () => toggle("attach") : undefined}
            plusActive={slot.panel === "attach"}
            onEmoji={() => toggle("emoji")}
            emojiActive={slot.panel === "emoji"}
            onInputFocus={() => slot.inputFocused()}
            insert={inserted}
        />
    </div>
    {#if attachable}
        <input
            bind:this={mediaInput}
            hidden
            type="file"
            accept="image/*,video/*"
            onchange={picked}
        />
        <input
            bind:this={cameraInput}
            hidden
            type="file"
            accept="image/*"
            capture="environment"
            onchange={picked}
        />
        <input bind:this={fileInput} hidden type="file" onchange={picked} />
    {/if}
{/if}

<!-- under the composer: the safe area, or the keyboard or a panel in its place -->
<div class="end" class:raised={slot.height > 0} class:voice={voiceActive}></div>
<div class="slot" style:height="{slot.height}px">
    {#if slot.panel === "emoji"}
        <EmojiPanel
            {gifs}
            covered={slot.covered}
            searching={slot.searching}
            onInsert={insert}
            onGif={sendGif}
            onSearch={(searching) => slot.search(searching)}
        />
    {:else if slot.panel === "attach"}
        <AttachPanel
            {gallery}
            media={pickable.includes("media")}
            file={pickable.includes("file")}
            {builders}
            onPick={pick}
            onBuild={build}
        />
    {/if}
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .blocked,
    .notice,
    .pill {
        padding-inline: 10px;
    }

    .notice {
        padding-block-end: var(--space-8);
    }

    // the design's pill (notes §3.3): 30px radius, 44px round buttons, at least 52px, 4px inside
    .pill {
        --composer-radius: 30px;
        --composer-btn: 44px;
        --composer-btn-radius: var(--radius-circle);
        --composer-min-h: 52px;
        --composer-pad: 4px;
    }

    // the safe area under the composer; just a gap above the keyboard or a panel
    .end {
        flex: none;
        height: max(var(--safe-bottom), var(--space-12));
        transition: height 0.25s var(--ease-out);

        &.raised {
            height: var(--space-8);
        }

        // room for the line under a voice message being recorded or reviewed
        &.voice {
            height: max(var(--safe-bottom), var(--space-24));
        }
    }

    .slot {
        position: relative;
        flex: none;
        overflow: hidden;
        transition: height 0.25s var(--ease-out);
    }

    @include reduced-motion {
        .end,
        .slot {
            transition: none;
        }
    }
</style>

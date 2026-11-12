<!-- A conversation's composer (native plan 05): the library's MessageComposer as a pill, its + and
     emoji buttons in the platform's order, opening the attach and emoji panels (06, 07) in the
     keyboard's place (the slot under it, KeyboardSlot, the panel's surface KeyboardPanel; the
     keyboard's space kept, as an empty panel, while it's down for a message's menu), with the
     chat's draft (its text, the reply or edit a swipe set, a file attached), the photos and videos
     picked (MediaPicks: the attach panel's selection, live in the composer), @mentions, a voice
     message, and the
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
        type AttachmentContent,
        type ChatSummary,
        type GiphyContent,
        type LazyFile,
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
        composerAnswer,
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
        leftMedia,
        MAX_MEDIA,
        MediaPicks,
        picksTray,
        sendMoreMedia,
        type PickOutcome,
        type PickSource,
    } from "@src/logic/composer/mediaPicks.svelte";
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
    import { recentMediaFile } from "@src/utils/native/recentMedia";
    import { getContext, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeOs } from "../../platform";
    import AttachPanel, { type RecentItem } from "./AttachPanel.svelte";
    import EmojiPanel from "./EmojiPanel.svelte";
    import KeyboardPanel from "./KeyboardPanel.svelte";
    import { KeyboardPanelState } from "./panelState.svelte";
    import { composerPlacement, type Panel } from "./keyboardSlot";
    import type { KeyboardSlot } from "./keyboardSlot.svelte";

    type Props = {
        /** The chat (the selected one). */
        chat: ChatSummary;
        /** The rows' context, for the reply or edit strip's names and text. */
        ctx: ConversationContext;
        slot: KeyboardSlot;
        os: NativeOs;
        /** In the apps, the attach panel's gallery strip and Recents; not on mobile web. */
        gallery: boolean;
        /** Says something went wrong (the native toast). */
        toast: (message: string) => void;
        /** A builder picked from the attach panel (a poll, a prize …). */
        onBuild: (builder: ComposerBuilder) => void;
        /** Goes to a message in the list (the one replied to or edited). */
        onJump: (index: number) => void;
        /**
         * Where toasts sit while the attach panel shows (at its bottom), in CSS pixels from the
         * window's bottom; undefined, above the composer.
         */
        onToastFloor: (px: number | undefined) => void;
    };

    let { chat, ctx, slot, os, gallery, toast, onBuild, onJump, onToastFloor }: Props = $props();

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
                permitted,
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
    // what's attached: the photos and videos picked (the attach panel's selection, 06 "live in the
    // composer"), each in as it's picked and prepared meanwhile; else the draft's attachment (a
    // file, or a photo pasted or attached on another device). They don't mix: a pick takes the
    // draft's attachment's place, and a file the picks'. A file's thumbnail is an object URL, let
    // go of as the pick goes.
    const picks = new MediaPicks((thumb) => URL.revokeObjectURL(thumb));
    $effect(() => () => picks.dispose());
    const first = $derived(draftAttachment(draft));
    const staged = $derived(picks.count > 0 ? picksTray(picks.picks) : composerAttachment(first, ctx));
    let nextFile = 0;
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

    // the rules turned down, the take stays quietly; refused, with an error
    async function sendVoice(recording: Blob, mimeType: string): Promise<false | undefined> {
        return composerAnswer(await sendVoiceRecording(client, context, recording, mimeType));
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

    // done once the message shows; the rules (or the PIN) turned down, the composer keeps the draft
    // quietly (false); refused, it rejects and the composer keeps the draft and says so. With
    // photos and videos picked: those picked as it's sent, once they're prepared, the first with
    // the caption, the others a message each after it, and the panel goes (06); any picked
    // meanwhile stay for the next. None could be prepared (each has said so): the caption alone.
    async function send(text: string): Promise<false | undefined> {
        typing.stopped();
        const ids = picks.ids();
        if (ids.length > 0) {
            const taken = await picks.take(ids);
            const { contents } = taken;
            if (contents.length > 0) {
                const sent = await sendComposed(client, chat, context, text, {
                    content: contents[0],
                    shown: true,
                });
                if (sent.kind !== "posted") return composerAnswer(sent);
                picks.removeSent(taken.picks);
                slot.close();
                if (contents.length > 1) void sendAfter(contents.slice(1));
                return undefined;
            }
            if (text.trim() === "") throw new Error("nothing prepared");
        }
        return composerAnswer(
            await sendComposed(client, chat, context, text, {
                content: draftAttachment(draft),
                shown: staged !== null,
            }),
        );
    }

    // the photos and videos after the first, a message each; refused, those left are picked again,
    // ahead of any picked since, as many as there's room for (those there isn't are said)
    async function sendAfter(after: readonly AttachmentContent[]) {
        const sent = await sendMoreMedia(client, context, after);
        if (sent.kind === "posted") return;
        const dropped = picks.restore(sent.left.map((c) => leftMedia(`left:${nextFile++}`, c)));
        toast(
            dropped === 0
                ? $_("native.composer.attach.notAllSent")
                : $_("native.composer.attach.notAllKept", { values: { count: dropped } }),
        );
    }

    async function saveEdit(text: string) {
        if (!(await submitEdit(client, context, draft, text))) {
            toast($_("errorEditingMessage"));
        }
    }

    // a file picked or pasted goes to the draft, in place of what's attached, if it may be sent here
    async function attachFile(file: File) {
        const outcome = await client.attachFile(file, context);
        if (outcome.kind !== "attached") toast(interpolate($_, attachRefusal(outcome, $_)));
        else picks.clear();
    }

    // one picked: into the composer at once, prepared meanwhile (in the chat it was picked in);
    // one that can't be is put back, and said. False when ten are picked already
    function mediaPicked(
        outcome: PickOutcome,
        source: PickSource,
        file: () => Promise<File | LazyFile>,
    ): boolean {
        if (outcome === "full") {
            toast($_("native.composer.attach.max"));
            return false;
        }
        if (outcome === "unpicked") return true;
        // they don't mix: a photo takes a file's place
        if (first !== undefined) localUpdates.draftMessages.setAttachment(context, undefined);
        const to = context;
        // this pick's own: the same tile put back and picked again is a new pick, with its own job
        const key = picks.keyOf(source.id);
        if (key === undefined) return true;
        const job = (async () => {
            try {
                const prepared = await client.prepareAttachment(await file(), to);
                if (prepared.kind === "prepared") {
                    picks.prepared(key, prepared.content);
                    return;
                }
                if (picks.unprepared(key)) toast(interpolate($_, attachRefusal(prepared, $_)));
            } catch (err) {
                console.warn("Couldn't read a photo or video picked", err);
                if (picks.unprepared(key)) toast($_("attachFileFailed"));
            }
        })();
        picks.preparing(key, job);
        return true;
    }

    // a tile tapped in the attach panel: picked, or put back
    function toggleRecent(item: RecentItem, duration: string | undefined) {
        const source = { id: item.id, video: item.video, thumb: item.thumb, duration };
        mediaPicked(picks.toggle(source), source, () => recentMediaFile(item.media));
    }

    // photos and videos from the camera or the browser's picker (a photo's thumbnail made once
    // it's in)
    function attachMedia(files: File[]) {
        for (const file of files) {
            const video = file.type.startsWith("video/");
            const source = { id: `file:${nextFile++}`, video };
            const outcome = picks.add(source, video ? undefined : () => URL.createObjectURL(file));
            if (!mediaPicked(outcome, source, async () => file)) break;
        }
    }

    function removeMedia(index: number) {
        if (picks.count > 0) picks.removeAt(index);
        else localUpdates.draftMessages.setAttachment(context, undefined);
    }

    function removeAttachment() {
        picks.clear();
        localUpdates.draftMessages.setAttachment(context, undefined);
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

    function toggle(which: Panel) {
        switch (slot.toggle(which)) {
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

    // a GIF is sent as it's tapped, as a reply to the draft's reply, and the panel goes (07)
    function sendGif(content: GiphyContent) {
        slot.close();
        void client.sendMessageWithContent(context, content, false);
    }

    // the attach panel's pickers: photos and videos (several), the camera, any file; the system's
    // picker closes the panel (what's picked comes back to the composer)
    let mediaInput = $state<HTMLInputElement>();
    let cameraInput = $state<HTMLInputElement>();
    let fileInput = $state<HTMLInputElement>();

    function pick(kind: "media" | "camera" | "file") {
        slot.close();
        if (kind === "media") mediaInput?.click();
        else if (kind === "camera") cameraInput?.click();
        else fileInput?.click();
    }

    // a builder is pushed over the chat; the panel stays as it is under it, for when it's back
    function build(builder: ComposerBuilder) {
        onBuild(builder);
    }

    function picked(e: { currentTarget: HTMLInputElement }) {
        const file = e.currentTarget.files?.[0];
        // so picking the same file again is a change too
        e.currentTarget.value = "";
        if (file !== undefined) void attachFile(file);
    }

    function pickedMedia(e: { currentTarget: HTMLInputElement }) {
        const files = [...(e.currentTarget.files ?? [])];
        e.currentTarget.value = "";
        if (files.length > 0) void attachMedia(files);
    }

    // the panel in the slot: dragged, grown, shrunk; made again as it opens or the other takes
    // its place (so that one starts at rest); attach grows to Recents in the apps only
    const panelKind = $derived(slot.panel);
    const panel = $derived(
        panelKind === undefined
            ? undefined
            : new KeyboardPanelState(panelKind === "emoji" || gallery),
    );

    // the keyboard asked for (the emoji panel's keyboard glyph) hasn't come: Android drops a focus's
    // keyboard while the last is still going down, so the field is focused afresh, once
    $effect(() => {
        slot.onMissed = () => {
            const field = document.activeElement;
            if (!(field instanceof HTMLTextAreaElement) || composer === undefined) return false;
            field.blur();
            composer.focus();
            return true;
        };
        return () => (slot.onMissed = undefined);
    });

    // a message's menu has closed, the keyboard's space held for it: the text box is focused
    // again, so the keyboard comes back up into it
    $effect(() => {
        slot.onRefocus = () => {
            composer?.focus();
            const field = document.activeElement;
            return field instanceof HTMLTextAreaElement && field.closest(".pill") !== null;
        };
        return () => (slot.onRefocus = undefined);
    });

    // the sheet knows the emoji panel's search (its backdrop, its handle's rules)
    $effect(() => {
        panel?.setSearch(slot.search);
    });

    const handleLabel = $derived.by(() => {
        const grown = (panel?.f ?? 0) > 0.5;
        if (slot.search === "strip") return $_("native.composer.emoji.searchHandle");
        if (slot.search === "grown") return $_("native.composer.gif.searchHandle");
        if (slot.panel === "emoji") {
            return $_(grown ? "native.composer.emoji.shrink" : "native.composer.emoji.expand");
        }
        if (!gallery) return $_("native.composer.attach.dragToClose");
        return $_(grown ? "native.composer.attach.dragBack" : "native.composer.attach.drag");
    });

    // the safe area under the slot, for a panel's resting height
    let safeBottom = $state(0);
    $effect(() => {
        slot.safeBottom = safeBottom;
    });

    // while the attach panel shows, toasts ("Up to 10 photos or videos") pop up at its bottom
    $effect(() => {
        onToastFloor(slot.panel === "attach" ? safeBottom : undefined);
    });
    $effect(() => () => onToastFloor(undefined));
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
            attachedPlaceholder={picks.count > 0
                ? $_("native.composer.attach.caption")
                : undefined}
            sendCount={picks.count}
            mediaLabel={staged?.type === "media"
                ? $_("native.composer.attach.ofMax", {
                      values: { count: Math.max(picks.count, 1), max: MAX_MEDIA },
                  })
                : undefined}
            onClearMedia={removeAttachment}
            clearMediaLabel={$_("native.composer.attach.clear")}
            onRemoveAttachment={removeAttachment}
            onRemoveMediaItem={removeMedia}
            onAddMedia={attachable && picks.count > 0 && picks.room > 0
                ? () => {
                      if (slot.panel !== "attach") toggle("attach");
                  }
                : undefined}
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
            multiple
            onchange={pickedMedia}
        />
        <input
            bind:this={cameraInput}
            hidden
            type="file"
            accept="image/*"
            capture="environment"
            onchange={pickedMedia}
        />
        <input bind:this={fileInput} hidden type="file" onchange={picked} />
    {/if}
{/if}

<!-- under the composer: the safe area, or the keyboard or a panel in its place -->
<div class="end" class:raised={slot.height > 0} class:voice={voiceActive}></div>
<span class="safe-bottom" bind:clientHeight={safeBottom} aria-hidden="true"></span>
<div class="slot" style:height="{slot.height}px">
    {#if slot.held}
        <!-- the keyboard's space, kept while it's down for a message's menu: an empty panel -->
        <div class="held" aria-hidden="true"></div>
    {/if}
    {#if panel !== undefined}
        <KeyboardPanel
            {panel}
            rest={slot.panelRest}
            covered={slot.covered}
            {handleLabel}
            handle
            onClose={() => slot.close()}
        >
            {#if slot.panel === "emoji"}
                <EmojiPanel
                    {panel}
                    userId={me}
                    {gifs}
                    search={slot.search}
                    onInsert={insert}
                    onGif={sendGif}
                    onSearch={(search) => slot.searchChanged(search)}
                />
            {:else}
                <AttachPanel
                    {panel}
                    {gallery}
                    media={pickable.includes("media")}
                    file={pickable.includes("file")}
                    {builders}
                    {picks}
                    onToggle={toggleRecent}
                    onCamera={() => pick("camera")}
                    onPickMedia={() => pick("media")}
                    onPickFile={() => pick("file")}
                    onBuild={build}
                />
            {/if}
        </KeyboardPanel>
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

    // the spacer a panel rests over (06), the panel itself at the bottom of the screen
    .slot {
        position: relative;
        flex: none;
        transition: height 0.25s var(--ease-out);
    }

    // the keyboard's space held for a message's menu, as an empty keyboard-area panel at rest
    // (KeyboardPanel's surface, top corners and line)
    .held {
        position: absolute;
        inset: 0;
        border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        background: var(--surface-1);
        box-shadow: inset 0 1px 0 var(--sheet-edge);
    }

    .safe-bottom {
        position: absolute;
        visibility: hidden;
        height: var(--safe-bottom);
    }

    @include reduced-motion {
        .end,
        .slot {
            transition: none;
        }
    }
</style>

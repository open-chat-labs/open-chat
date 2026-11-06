<!-- The conversation's composer: who's typing, and the message being written, with a photo, video
     or file attached (picked from its + menu, pasted, or dropped on the conversation), or a voice
     message recorded. The screen reads the chat's draft, typers, throttle and whether the reader
     can send, and does the sending (with mentions and markdown, as the old UI's MessageEntry did)
     and the attaching; the composer tells it while the reader types, and hands it the files picked
     or pasted and the voice recorded. Where the reader can't send, the old footer's reason shows
     instead, and for a preview its bar (CommunityPreviewBar: Join, Back; 8b); a notice (the
     throttle countdown, a video being prepared) shows over it. Mount it once per chat (keyed). -->
<script lang="ts">
    import CommunityPreviewBar from "@openchat/ui/src/features/components/CommunityPreviewBar.svelte";
    import Banner from "@openchat/ui/src/lib/components/Banner.svelte";
    import ComposerBar from "@openchat/ui/src/lib/components/ComposerBar.svelte";
    import type {
        ComposerAttachKind,
        ComposerAttachment,
        ComposerContext,
        ComposerMention,
    } from "@openchat/ui/src/lib/types";
    import { untrack, type ComponentProps } from "svelte";
    import { _ } from "svelte-i18n";
    import {
        TypingNotifier,
        type ComposerBuilder,
        type EntryBlock,
    } from "@src/logic/composer/composer";
    import { fileFromDataTransferItems } from "@src/utils/datatransfer";

    let {
        block,
        preview,
        draft,
        typingNames,
        notice,
        placeholder,
        enterSends,
        autofocus,
        onDraft,
        onStartTyping,
        onStopTyping,
        onSend,
        context,
        onCancelContext,
        onSubmitEdit,
        onJumpContext,
        attachment,
        attachKinds,
        onFile,
        onBuild,
        onRemoveAttachment,
        onVoice,
        voiceMimeType,
        voiceMaxBytes,
        onMentionQuery,
        mentions,
        onVoiceActive,
    }: {
        // what stands in for the composer where the reader can't send
        block: EntryBlock | undefined;
        // a preview's bar (Join, Back), shown for a "preview" block (8b)
        preview: ComponentProps<typeof CommunityPreviewBar> | undefined;
        // the chat's draft, read once when the composer mounts
        draft: string;
        // the others in this chat who are typing
        typingNames: string[];
        // shown over the composer: the throttle countdown, a video being prepared
        notice: { text: string; tone: "info" | "warning" } | undefined;
        placeholder: string;
        enterSends: boolean;
        // the text box takes focus as the composer mounts (it's keyed by chat, so on each chat opened)
        autofocus: boolean;
        // an empty or blank draft is no draft
        onDraft: (text: string | undefined) => void;
        onStartTyping: () => void;
        onStopTyping: () => void;
        // settles once the message shows in the chat; rejects if it was refused, and the composer
        // keeps the draft and says it couldn't send
        onSend: (text: string) => Promise<void>;
        // the message being replied to or edited (the draft's), shown above the text
        context: ComposerContext | null;
        onCancelContext: () => void;
        onSubmitEdit: (text: string) => void;
        // goes to the message replied to or edited; none where it isn't in this chat
        onJumpContext: (() => void) | undefined;
        // the draft's attachment, staged above the text
        attachment: ComposerAttachment | null;
        // what the + menu offers: to pick from the device, and the builders (no + with none)
        attachKinds: ComposerAttachKind[];
        // a file picked, pasted or dropped; none where nothing can be attached
        onFile: ((file: File) => void) | undefined;
        // a builder picked from the + menu (a poll, a prize …)
        onBuild: (builder: ComposerBuilder) => void;
        onRemoveAttachment: () => void;
        // sends a voice message recorded here; none where the reader can't record one (no mic
        // then); rejects if it wasn't sent, and the take stays to send again
        onVoice: ((recording: Blob) => Promise<void>) | undefined;
        // what a recording is made in, and the most it may hold
        voiceMimeType: string | undefined;
        voiceMaxBytes: number;
        // the "@word" being typed, and who's offered for it
        onMentionQuery: (query: string | undefined) => void;
        mentions: ComposerMention[];
        // a voice message is being recorded or reviewed, or that's over (nothing can be attached
        // meanwhile: sending it posts the draft)
        onVoiceActive: (active: boolean) => void;
    } = $props();

    let mediaInput = $state<HTMLInputElement>();
    let fileInput = $state<HTMLInputElement>();

    // the + menu's photo / video and file items open the device's picker, the others their builder
    function pick(kind: ComposerAttachKind) {
        if (kind === "media") mediaInput?.click();
        else if (kind === "file") fileInput?.click();
        else onBuild(kind);
    }

    function picked(e: { currentTarget: HTMLInputElement }) {
        const file = e.currentTarget.files?.[0];
        // so picking the same file again is a change too
        e.currentTarget.value = "";
        if (file !== undefined) onFile?.(file);
    }

    // a file pasted into the text box is attached, not pasted as text
    function paste(e: ClipboardEvent) {
        if (onFile === undefined || e.clipboardData === null) return;
        const file = fileFromDataTransferItems([...e.clipboardData.items]);
        if (file === undefined) return;
        e.preventDefault();
        onFile(file);
    }

    const blocked = $derived(banner(block));

    // what stands in for the composer, as a banner in the old footer's words
    function banner(
        block: EntryBlock | undefined,
    ): { key: string; tone: "info" | "warning" } | undefined {
        switch (block?.kind) {
            case undefined:
                return undefined;
            case "suspended":
                return { key: "accountSuspended", tone: "warning" };
            case "frozen":
                return { key: "chatFrozen", tone: "warning" };
            case "blocked":
                return { key: "userIsBlocked", tone: "info" };
            // the preview's bar shows instead (below); this only while it isn't known
            case "preview":
                return { key: block.lapsed ? "access.lapsed.label" : "readOnlyChat", tone: "info" };
            case "external":
                return { key: "externalContent.disclaimer", tone: "warning" };
            case "read_only":
                return { key: block.key, tone: "info" };
        }
    }

    // the chat's draft when the composer mounts (it's keyed by chat)
    const text = untrack(() => draft);

    const typing = new TypingNotifier(
        () => onStartTyping(),
        () => onStopTyping(),
    );
    // leaving, "stopped typing" would go to the chat selected next, so the others' "typing" is left
    // to run out by itself
    $effect(() => () => typing.cancel());
    // leaving, no "@word" is being typed here any more
    $effect(() => () => untrack(() => onMentionQuery(undefined)));

    function onInput(text: string) {
        // an empty or blank draft is no draft (as the old composer)
        onDraft(text.trim() === "" ? undefined : text);
        typing.input(text);
    }

    function send(text: string): Promise<void> {
        typing.stopped();
        return onSend(text);
    }
</script>

{#if block?.kind === "preview" && preview !== undefined}
    <!-- the gap above it the composer has (its top padding), off the messages -->
    <div class="preview">
        <CommunityPreviewBar {...preview} />
    </div>
{:else if blocked !== undefined}
    <div class="blocked">
        <Banner tone={blocked.tone} text={$_(blocked.key)} />
    </div>
{:else}
    <!-- TODO(phase 5, 5c): GIFs and bot commands -->
    <div class="entry" onpaste={paste}>
        <ComposerBar
            {text}
            {typingNames}
            bannerText={notice?.text ?? ""}
            bannerTone={notice?.tone ?? "info"}
            {placeholder}
            {enterSends}
            {autofocus}
            {onInput}
            onSend={send}
            {context}
            {onCancelContext}
            {onSubmitEdit}
            {onJumpContext}
            {attachment}
            onAttach={attachKinds.length === 0 ? undefined : pick}
            {attachKinds}
            {onRemoveAttachment}
            onRemoveMediaItem={() => onRemoveAttachment()}
            onVoice={onVoice === undefined ? undefined : ({ blob }) => onVoice(blob)}
            {voiceMimeType}
            {voiceMaxBytes}
            {onMentionQuery}
            {onVoiceActive}
            {mentions} />
    </div>
    {#if onFile !== undefined}
        <input
            bind:this={mediaInput}
            hidden
            type="file"
            accept="image/*,video/*"
            onchange={picked} />
        <input bind:this={fileInput} hidden type="file" onchange={picked} />
    {/if}
{/if}

<style lang="scss">
    .preview {
        display: flex;
        flex-direction: column;
        padding-top: var(--space-12);
    }

    .blocked {
        padding: var(--space-12) var(--space-14);
    }

    // only there to hear a paste: lays nothing out
    .entry {
        display: contents;
    }
</style>

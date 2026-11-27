<!-- The conversation's composer: who's typing, and the message being written, with a photo, video
     or file attached (picked from its + menu, pasted, or dropped on the conversation), or a voice
     message recorded. The screen reads the chat's draft, typers, throttle and whether the reader
     can send, and does the sending (with mentions and markdown, as the old UI's MessageEntry did)
     and the attaching; the composer tells it while the reader types, and hands it the files picked
     or pasted and the voice recorded. Where the reader can't send, the old footer's reason shows
     instead (with Sign in for a guest), and for a preview its bar (CommunityPreviewBar: Join, or
     Sign in to join for a guest, and Back; 8b); a notice (the
     throttle countdown, a video being prepared) shows over it. The emoji picker's GIF tab searches
     Klipy (GifFeed), where GIFs may be sent here and the build has a Klipy key; a GIF picked is
     the draft's attachment, sent with Send, the text its caption (the user's decision of
     2026-11-19, not 06's "Picking sends the GIF"). A "/" at the start of the text lists the bot
     commands the screen offers for it; a pick runs it, or asks for its arguments first (the
     screen's). The text box is the old trees' rich-text editor (core/richText, #10576), once its
     chunk is here (App warms it): formatting shows as it's typed, a mention picked goes in as one
     (sent as `@UserId`), and the draft is its markdown. The emoji picker offers Recent, OpenChat's
     custom emoji packs and every emoji the device draws, by category, with a search (the old
     picker's, from the same emoji data: EmojiSections, composerEmoji.adapter); a custom emoji goes
     in as one, and one from a pack not bought yet offers to buy it (PremiumItemDialog), then goes
     in. Mount it once per chat (keyed). -->
<script lang="ts">
    import CommunityPreviewBar from "@openchat/ui/src/features/components/CommunityPreviewBar.svelte";
    import Banner from "@openchat/ui/src/lib/components/Banner.svelte";
    import ComposerBar from "@openchat/ui/src/lib/components/ComposerBar.svelte";
    import type {
        ComposerAttachKind,
        ComposerAttachment,
        ComposerCommand,
        ComposerContext,
        ComposerEditorArgs,
        ComposerGif,
        ComposerMention,
        ComposerEditor,
        PickerEmojiItem,
    } from "@openchat/ui/src/lib/types";
    import {
        customEmojis,
        type GiphyContent,
        type PremiumItem,
        type UserOrUserGroup,
    } from "@client";
    import ComposerRichText from "@src/core/richText/ComposerRichText.svelte";
    import { customEmojiMatching, customEmojiPacks } from "@src/logic/composer/customEmoji";
    import { EmojiSections } from "@src/logic/composer/emojiSections.svelte";
    import { countEmojiPicked } from "@src/utils/emojis";
    import PremiumItemDialog from "../profile/PremiumItemDialog.svelte";
    import { composerEmojiSource } from "./composerEmoji.adapter";
    import { RichTextEditorLoad } from "@src/core/richText/richTextEditorLoad.svelte";
    import { untrack, type ComponentProps } from "svelte";
    import { _ } from "svelte-i18n";
    import {
        entryBlockBanner,
        TypingNotifier,
        type ComposerBuilder,
        type EntryBlock,
    } from "@src/logic/composer/composer";
    import { GifFeed } from "@src/logic/composer/gifFeed.svelte";
    import { gifContent } from "@src/logic/composer/gifs";
    import { composerGifs } from "@src/logic/composer/composerProps";
    import { fileFromDataTransferItems } from "@src/utils/datatransfer";
    import { klipyApiKey } from "@src/utils/features";

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
        onEditAttachment,
        onRemoveAttachment,
        onVoice,
        voiceMimeType,
        voiceMaxBytes,
        onMentionQuery,
        mentions,
        resolveMention,
        onVoiceActive,
        onGif,
        onCommandQuery,
        commands,
        onPickCommand,
        onSignIn,
        userId,
        premiumItems,
        chitBalance,
    }: {
        // whose Recent emoji the picker shows
        userId: string;
        // the premium items the user has bought (the custom emoji packs among them), and their CHIT
        // balance, to buy one with
        premiumItems: ReadonlySet<PremiumItem>;
        chitBalance: number;
        // what stands in for the composer where the reader can't send
        block: EntryBlock | undefined;
        // a guest's Sign in, where that's why they can't send
        onSignIn: () => void;
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
        // keeps the draft and says it couldn't send; false (the rules or the PIN turned down) keeps
        // it without a word (logic/composer's composerAnswer)
        onSend: (text: string) => Promise<false | undefined>;
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
        // the staged payment's chip's Edit: its builder again
        onEditAttachment: () => void;
        onRemoveAttachment: () => void;
        // sends a voice message recorded here; none where the reader can't record one (no mic
        // then); rejects if it wasn't sent, and the take stays to send again (without a word for
        // false, the rules turned down)
        onVoice: ((recording: Blob) => Promise<false | undefined>) | undefined;
        // what a recording is made in, and the most it may hold
        voiceMimeType: string | undefined;
        voiceMaxBytes: number;
        // the "@word" being typed, and who's offered for it
        onMentionQuery: (query: string | undefined) => void;
        mentions: ComposerMention[];
        // who a mention picked from the list is (the editor puts them in as a mention)
        resolveMention: (mention: ComposerMention) => UserOrUserGroup | undefined;
        // a voice message is being recorded or reviewed, or that's over (nothing can be attached
        // meanwhile: sending it posts the draft)
        onVoiceActive: (active: boolean) => void;
        // takes a GIF picked from the emoji picker's GIF tab (the draft's attachment, sent with
        // Send); none where no GIF may be attached now (no GIF tab then)
        onGif: ((content: GiphyContent) => void) | undefined;
        // the bot command being typed (the text's first line, while it starts with "/"), the
        // commands offered for it, and one picked: resolves true once it's sent (the text goes),
        // false if it was dropped (the text stays)
        onCommandQuery: (query: string | undefined) => void;
        commands: ComposerCommand[];
        onPickCommand: (command: ComposerCommand) => Promise<boolean>;
    } = $props();

    // the rich-text editor in the text box, once its chunk is here
    const richText = new RichTextEditorLoad();

    // the GIF tab's search (Klipy's: trending, or what's typed), in a build with a Klipy key
    const feed = klipyApiKey === undefined ? undefined : new GifFeed(klipyApiKey);
    const gifs = $derived(
        feed === undefined || onGif === undefined
            ? undefined
            : composerGifs(feed, $_("ui.messageComposer.gif")),
    );

    function pickGif(picked: ComposerGif) {
        const gif = feed?.gifs.find((g) => g.id === picked.key);
        if (gif !== undefined) onGif?.(gifContent(gif));
    }

    // ---- the emoji picker's emoji: Recent and every emoji by category, got as it first opens
    // (again after they failed), and the custom ones

    const emojiSections = new EmojiSections(untrack(() => userId));
    let emojiAsked = false;
    let emojiQuery = $state("");
    $effect(() => () => emojiSections.dispose());

    function emojiOpened() {
        emojiQuery = "";
        emojiSections.clearSearch();
        if (!emojiAsked || emojiSections.failed) {
            emojiAsked = true;
            emojiSections.failed = false;
            void emojiSections.load();
        }
    }

    function emojiQueried(query: string) {
        emojiQuery = query;
        emojiSections.search(query);
    }

    const emojiPacks = $derived(customEmojiPacks(customEmojis, premiumItems));
    const emoji = $derived(
        composerEmojiSource({
            recent: emojiSections.recent,
            categories: emojiSections.categories,
            loading: emojiSections.loading,
            failed: emojiSections.failed,
            packs: emojiPacks,
            customMatches:
                emojiQuery.trim() === ""
                    ? undefined
                    : customEmojiMatching(emojiQuery, customEmojis),
            matches: emojiSections.matches,
            labels: {
                recent: $_("native.composer.emoji.recent"),
                categories: {
                    smileys: $_("native.composer.emoji.smileys"),
                    people: $_("native.composer.emoji.people"),
                    animals: $_("native.composer.emoji.animals"),
                    food: $_("native.composer.emoji.food"),
                    travel: $_("native.composer.emoji.travel"),
                    activities: $_("native.composer.emoji.activities"),
                    objects: $_("native.composer.emoji.objects"),
                    symbols: $_("native.composer.emoji.symbols"),
                    flags: $_("native.composer.emoji.flags"),
                },
                unavailable: $_("native.composer.emoji.unavailable"),
                categoriesBar: $_("native.composer.emoji.categories"),
                price: (chit) =>
                    $_("premiumItem.priceTooltip", { values: { price: chit.toLocaleString() } }),
            },
            onQuery: emojiQueried,
            onOpen: emojiOpened,
        }),
    );

    // a character picked counts towards Recent and the emoji data's favourites (as the old
    // pickers); custom emoji aren't kept in Recent, which the native tree shares
    function emojiPicked(item: PickerEmojiItem) {
        if (item.kind !== "char") return;
        emojiSections.picked(item.char);
        countEmojiPicked(emojiBase(item.char));
    }

    // the emoji without its skin tone, which its use is counted by
    function emojiBase(char: string): string {
        for (const list of [emojiSections.matches, ...emojiSections.categories]) {
            const found = list?.find((e) => e.char === char);
            if (found !== undefined) return found.base;
        }
        return char;
    }

    // a custom emoji from a pack not bought yet: buy the pack, then it goes in
    let buyingEmoji = $state<{ code: string; item: PremiumItem }>();
    // the editor in the text box, while it's there, for an emoji bought to go in
    let textEditor: ComposerEditor | undefined;

    function lockedEmoji(item: PickerEmojiItem & { kind: "image" }) {
        const custom = customEmojis.get(item.code);
        if (custom !== undefined) buyingEmoji = { code: custom.code, item: custom.premiumItem };
    }

    function boughtEmoji() {
        const code = buyingEmoji?.code;
        buyingEmoji = undefined;
        if (code !== undefined) textEditor?.insertEmoji?.(code);
    }

    function withEditorHandle(args: ComposerEditorArgs): ComposerEditorArgs {
        return {
            ...args,
            register: (ed) => {
                textEditor = ed;
                const unregister = args.register(ed);
                return () => {
                    if (textEditor === ed) textEditor = undefined;
                    unregister();
                };
            },
        };
    }

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

    // what stands in for the composer, as a banner in the old footer's words (a preview's bar
    // shows instead, below, once it's known)
    const blocked = $derived(block === undefined ? undefined : entryBlockBanner(block));

    // the chat's draft when the composer mounts (it's keyed by chat)
    const text = untrack(() => draft);

    const typing = new TypingNotifier(
        () => onStartTyping(),
        () => onStopTyping(),
    );
    // leaving, "stopped typing" would go to the chat selected next, so the others' "typing" is left
    // to run out by itself
    $effect(() => () => typing.cancel());
    // leaving, no "@word" or command is being typed here any more
    $effect(() => () => untrack(() => onMentionQuery(undefined)));
    $effect(() => () => untrack(() => onCommandQuery(undefined)));

    function onInput(text: string) {
        // an empty or blank draft is no draft (as the old composer)
        onDraft(text.trim() === "" ? undefined : text);
        typing.input(text);
    }

    function send(text: string): Promise<false | undefined> {
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
        <!-- a guest's offers to sign in (the design's "Composer → Sign in prompt") -->
        <Banner
            tone={blocked.tone}
            text={$_(blocked.key)}
            actionLabel={blocked.signIn ? $_("login") : ""}
            actionHandler={blocked.signIn ? onSignIn : undefined} />
    </div>
{:else}
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
            {onEditAttachment}
            {onRemoveAttachment}
            onRemoveMediaItem={() => onRemoveAttachment()}
            onVoice={onVoice === undefined ? undefined : ({ blob }) => onVoice(blob)}
            {voiceMimeType}
            {voiceMaxBytes}
            {onMentionQuery}
            {onVoiceActive}
            {mentions}
            {gifs}
            onGifSearch={gifs === undefined ? undefined : (query) => void feed?.search(query)}
            onMoreGifs={gifs === undefined ? undefined : () => void feed?.more()}
            onPickGif={gifs === undefined ? undefined : pickGif}
            {onCommandQuery}
            {commands}
            {onPickCommand}
            {emoji}
            onEmojiPicked={emojiPicked}
            onLockedEmoji={lockedEmoji}
            editor={richText.component === undefined ? undefined : richTextField} />
        {#snippet richTextField(args: ComposerEditorArgs)}
            {#if richText.component !== undefined}
                <ComposerRichText
                    Editor={richText.component}
                    args={withEditorHandle(args)}
                    {resolveMention} />
            {/if}
        {/snippet}
    </div>
    {#if buyingEmoji !== undefined}
        <PremiumItemDialog
            item={buyingEmoji.item}
            balance={chitBalance}
            onUse={boughtEmoji}
            onClose={() => (buyingEmoji = undefined)} />
    {/if}
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

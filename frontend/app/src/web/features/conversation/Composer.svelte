<!-- The conversation's composer (phase 3c, text): who's typing, and the message being written. The
     screen reads the chat's draft, typers, throttle and whether the reader can send, and does the
     sending (with mentions and markdown, as the old UI's MessageEntry did); the composer tells it
     while the reader types. Where the reader can't send, the old footer's reason shows instead;
     while sending is throttled, a countdown shows over it. Mount it once per chat (keyed). -->
<script lang="ts">
    import Banner from "@openchat/ui/src/lib/components/Banner.svelte";
    import ComposerBar from "@openchat/ui/src/lib/components/ComposerBar.svelte";
    import { untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { TypingNotifier, type EntryBlock } from "@src/logic/composer/composer";

    let {
        block,
        draft,
        typingNames,
        throttled,
        enterSends,
        autofocus,
        onDraft,
        onStartTyping,
        onStopTyping,
        onSend,
    }: {
        // what stands in for the composer where the reader can't send
        block: EntryBlock | undefined;
        // the chat's draft, read once when the composer mounts
        draft: string;
        // the others in this chat who are typing
        typingNames: string[];
        // the throttle countdown's text, "" while sending isn't throttled
        throttled: string;
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
    } = $props();

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
            // TODO(phase 8, 8b): a preview's Join (and its access gates), as the old PreviewFooter
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

{#if blocked !== undefined}
    <div class="blocked">
        <Banner tone={blocked.tone} text={$_(blocked.key)} />
    </div>
{:else}
    <!-- TODO(phase 5, 5c): attachments, GIFs, voice, replies and edits -->
    <ComposerBar
        {text}
        {typingNames}
        bannerText={throttled}
        bannerTone="warning"
        {enterSends}
        {autofocus}
        {onInput}
        onSend={send} />
{/if}

<style>
    .blocked {
        padding: var(--space-12) var(--space-14);
    }
</style>

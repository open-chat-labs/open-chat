<!-- The composer's "+" → Meme Fighter (5d): the Meme Fighter maker in a frame, as both old builders
     have it (startMemeMaker: only the maker's origin, in its own frame, is listened to), styled
     with the theme's surface, ink and accent. Once a meme is made it's shown to send, or to start
     again from (Reset); it's sent at once, as the old builders send it (sendContent, replying to
     the draft's reply), at the size it shows at. The library's MemeFighterDialog renders memes
     from templates the app doesn't have, so it isn't used (GAPS).
     TODO(design): the design has no frame for the maker; DialogShell with the old builders'
     words. -->
<script lang="ts">
    import type { OpenChat } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import { memeFighterContent, memeMakerStyle, startMemeMaker } from "@src/utils/memeFighter";
    import { getContext, onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "meme_fighter" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    let memeUrl = $state<string>();
    let iframe = $state<HTMLIFrameElement>();
    let img = $state<HTMLImageElement>();
    let sending = $state(false);
    let failed = $state(false);
    let stopListening: (() => void) | undefined;

    const style = memeMakerStyle((name) =>
        getComputedStyle(document.documentElement).getPropertyValue(name),
    );

    function stopMaker() {
        stopListening?.();
        stopListening = undefined;
    }

    onDestroy(stopMaker);

    // the maker loads into the frame as it's shown, and again after a reset
    $effect(() => {
        // (none, or null once it's gone, while the meme shows)
        const frame = iframe;
        if (!frame) return;
        stopMaker();
        stopListening = startMemeMaker(frame, style, (url) => (memeUrl = url));
    });

    // the maker is shown again, and loads afresh
    function reset() {
        failed = false;
        memeUrl = undefined;
    }

    async function send() {
        if (memeUrl === undefined || img === undefined || sending) return;
        sending = true;
        failed = false;
        const outcome = await client.sendContent(
            dialog.context,
            memeFighterContent(memeUrl, img.getBoundingClientRect()),
        );
        sending = false;
        if (outcome.kind === "posted") {
            onClose();
        } else {
            failed = true;
        }
    }
</script>

<DialogShell title="Meme Fighter" width={560} height="auto" {onClose}>
    <div class="maker">
        {#if memeUrl !== undefined}
            <img bind:this={img} class="meme" src={memeUrl} alt="" />
        {:else}
            <iframe bind:this={iframe} title="Meme Fighter" width="500" height="400"></iframe>
        {/if}
    </div>
    {#if failed}
        <p class="error">{$_("errorSendingMessage")}</p>
    {/if}
    <div class="actions">
        <Button label={$_("reset")} variant="ghost" onClick={reset} />
        <Button label={$_("cancel")} variant="secondary" onClick={onClose} />
        <Button
            label={$_("send")}
            disabled={memeUrl === undefined || sending}
            onClick={send} />
    </div>
</DialogShell>

<style lang="scss">
    .maker {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 400px;
    }

    iframe {
        border: none;
        max-width: 100%;
    }

    .meme {
        max-width: 100%;
        max-height: 60vh;
        border-radius: var(--radius-md);
    }

    .error {
        margin: var(--space-12) 0 0;
        font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
        color: var(--status-danger);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
        margin-top: var(--space-16);
    }
</style>

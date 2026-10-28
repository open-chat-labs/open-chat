<script lang="ts">
    import { botState, type MessageContext, type MiniAppContent } from "@client";
    import Markdown from "@src/core/Markdown.svelte";
    import { miniAppUrl } from "@src/utils/miniApp";
    import Translatable from "@shared_components/Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import MiniAppFrame from "./MiniAppFrame.svelte";

    interface Props {
        content: MiniAppContent;
        messageContext: MessageContext;
        messageId: bigint;
        // the bot which posted it
        senderId: string;
        // eg. while previewing a chat, whose app the user can't open
        readonly: boolean;
        reply?: boolean;
        pinned?: boolean;
        blockLevelMarkdown: boolean;
    }

    let {
        content,
        messageContext,
        messageId,
        senderId,
        readonly,
        reply = false,
        pinned = false,
        blockLevelMarkdown,
    }: Props = $props();

    let bot = $derived(botState.externalBots.get(senderId));
    let url = $derived(
        bot === undefined ? undefined : miniAppUrl(bot.endpoint, window.location.origin),
    );
    let open = $state(false);
</script>

{#if reply}
    <Markdown text={content.text} oneLine suppressLinks />
{:else}
    <Markdown inline={!blockLevelMarkdown} suppressLinks={pinned} text={content.text} />
    {#if !readonly && url !== undefined}
        <div class="open">
            <Button tiny onClick={() => (open = true)}>
                <Translatable resourceKey={i18nKey("bots.miniApp.open")} />
            </Button>
        </div>
    {/if}
{/if}

{#if open && url !== undefined && bot !== undefined}
    <MiniAppFrame
        {url}
        botName={bot.name}
        chatId={messageContext.chatId}
        threadRootMessageIndex={messageContext.threadRootMessageIndex}
        {messageId}
        botId={senderId}
        onClose={() => (open = false)} />
{/if}

<style lang="scss">
    .open {
        margin-top: $sp3;
    }
</style>

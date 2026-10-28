<script lang="ts">
    import Markdown from "@src/core/Markdown.svelte";
    import { MiniAppButtons } from "@src/logic/miniApp/miniAppButtons.svelte";
    import type { MessageContext, MiniAppContent, OpenChat } from "@client";
    import { getContext } from "svelte";
    import { toastStore } from "../../stores/toast";
    import Button from "../Button.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: MiniAppContent;
        messageContext: MessageContext;
        messageId: bigint;
        // the bot which posted it
        senderId: string;
        // eg. in a reply, a pinned message, or while previewing a chat
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

    const buttons = new MiniAppButtons(client, () => ({ messageContext, messageId, botId: senderId }));

    async function press(button: MiniAppContent["buttonRows"][number][number]) {
        const outcome = await buttons.press(button);
        if (outcome?.kind === "failed") {
            toastStore.showFailureToast(outcome.reason);
        }
    }
</script>

{#if reply}
    <Markdown text={content.text} oneLine suppressLinks />
{:else}
    <Markdown inline={!blockLevelMarkdown} suppressLinks={pinned} text={content.text} />
{/if}
{#if !reply && !readonly}
    {#each content.buttonRows as row}
        <div class="row">
            {#each row as button (button.id)}
                <Button
                    tiny
                    secondary={button.style === "secondary"}
                    danger={button.style === "danger"}
                    loading={buttons.pending === button.id}
                    disabled={buttons.pending !== undefined}
                    onClick={() => press(button)}>{button.label}</Button>
            {/each}
        </div>
    {/each}
{/if}

<style lang="scss">
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: $sp2;
        margin-top: $sp3;
    }
</style>

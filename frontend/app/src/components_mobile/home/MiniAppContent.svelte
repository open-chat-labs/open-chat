<script lang="ts">
    import Markdown from "@src/core/Markdown.svelte";
    import { MiniAppButtons } from "@src/logic/miniApp/miniAppButtons.svelte";
    import type { MessageContext, MiniAppContent, OpenChat } from "@client";
    import { Button, Column, Row } from "component-lib";
    import { getContext } from "svelte";
    import { toastStore } from "../../stores/toast";

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
    }

    let { content, messageContext, messageId, senderId, readonly, reply = false }: Props = $props();

    const buttons = new MiniAppButtons(client, () => ({ messageContext, messageId, botId: senderId }));

    async function press(button: MiniAppContent["buttonRows"][number][number]) {
        const outcome = await buttons.press(button);
        if (outcome?.kind === "failed") {
            toastStore.showFailureToast(outcome.reason);
        }
    }
</script>

<Column gap={"md"}>
    <Markdown text={content.text} />
    {#if !reply && !readonly}
        {#each content.buttonRows as row}
            <Row gap={"sm"} wrap>
                {#each row as button (button.id)}
                    <Button
                        width={"hug"}
                        secondary={button.style === "secondary"}
                        danger={button.style === "danger"}
                        loading={buttons.pending === button.id}
                        disabled={buttons.pending !== undefined}
                        onClick={() => press(button)}>{button.label}</Button>
                {/each}
            </Row>
        {/each}
    {/if}
</Column>

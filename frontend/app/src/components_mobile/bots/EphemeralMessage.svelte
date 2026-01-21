<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Column, IconButton, Row, Subtitle } from "component-lib";
    import { botState, type EphemeralMessageEvent } from "openchat-client";
    import { onMount } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { Tween } from "svelte/motion";
    import Translatable from "../Translatable.svelte";
    import ChatMessageContent from "../home/ChatMessageContent.svelte";
    import BotAvatar from "./BotAvatar.svelte";

    const duration = 10_000;

    interface Props {
        event: EphemeralMessageEvent;
        onClose: () => void;
    }

    let perc = new Tween(100, { duration });
    let { event, onClose }: Props = $props();
    let bot = $derived(botState.externalBots.get(event.botId));
    let timer = $state<number>();

    onMount(() => {
        perc.target = 0;
        timer = window.setTimeout(onClose, duration);
        return clearTimer;
    });

    function clearTimer() {
        window.clearTimeout(timer);
        timer = undefined;
    }

    function pause() {
        perc.target = perc.current;
        clearTimer();
    }

    function resume() {
        const remainingTime = (perc.current / 100) * duration;
        perc.set(0, { duration: remainingTime });
        timer = window.setTimeout(onClose, remainingTime);
    }

    function closeClicked() {
        clearTimer();
        onClose();
    }
</script>

{#if bot}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <Column>
        <div onmousedown={pause} onmouseup={resume} class="content">
            <Row padding={["md", "zero"]} gap={"sm"} crossAxisAlignment={"center"}>
                <BotAvatar size={"xs"} {bot} />
                <Subtitle fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey(`${bot.name} /${event.commandName}`)} />
                </Subtitle>
                <IconButton size={"sm"} onclick={closeClicked}>
                    {#snippet icon(color)}
                        <Close size={"1em"} {color} />
                    {/snippet}
                </IconButton>
            </Row>
            <ChatMessageContent
                failed={false}
                messageId={event.message.messageId}
                messageIndex={0}
                messageContext={{ chatId: { kind: "direct_chat", userId: "" } }}
                intersecting={false}
                blockLevelMarkdown={event.message.blockLevelMarkdown}
                edited={false}
                senderId={bot.id}
                fill={false}
                readonly={true}
                showPreviews={false}
                content={event.message.messageContent} />
        </div>
        <Row height={{ size: "0.75rem" }}>
            <div style={`width: ${perc.current}%`} class="bar"></div>
        </Row>
    </Column>
{/if}

<style lang="scss">
    .content {
        padding: $sp4;
    }

    .bar {
        height: toRem(10);
        background-color: var(--warn);
    }
</style>

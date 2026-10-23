<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Column, IconButton, Row, Subtitle } from "component-lib";
    import { botState, type EphemeralMessageEvent } from "@client";
    import { onMount } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { Tween } from "svelte/motion";
    import Translatable from "@shared_components/Translatable.svelte";
    import ChatMessageContent from "../home/ChatMessageContent.svelte";
    import BotAvatar from "./BotAvatar.svelte";

    // Long enough to read and act on a reply with several steps or a link, eg. a bridge bot's
    // instructions. It can be closed sooner.
    const duration = 60_000;

    interface Props {
        event: EphemeralMessageEvent;
        onClose: () => void;
    }

    const perc = new Tween(100, { duration });
    let { event, onClose }: Props = $props();
    let bot = $derived(botState.externalBots.get(event.botId));
    let timer = $state<number>();

    onMount(() => {
        perc.target = 0;
        timer = window.setTimeout(onClose, duration);
        // Paused while the app is hidden, eg. while someone follows a link in the reply elsewhere,
        // so it's still there when they come back
        const visibilityChanged = () => (document.hidden ? pause() : resume());
        if (document.hidden) pause();
        document.addEventListener("visibilitychange", visibilityChanged);
        return () => {
            document.removeEventListener("visibilitychange", visibilityChanged);
            clearTimer();
        };
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
        // So a resume without a pause, eg. a mouseup from a drag which started elsewhere, doesn't
        // leave a second timer running
        clearTimer();
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
                ogPreviews={[]}
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

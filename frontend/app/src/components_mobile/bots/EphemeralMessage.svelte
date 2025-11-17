<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { botState, type EphemeralMessageEvent } from "openchat-client";
    import { onMount } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { Tween } from "svelte/motion";
    import HoverIcon from "../HoverIcon.svelte";
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
    <div class="ephemeral-msg">
        <div onmousedown={pause} onmouseup={resume} class="content">
            <div class="header">
                <BotAvatar size={"xs"} {bot} />
                <div class="title">
                    <Translatable resourceKey={i18nKey(`${bot.name} /${event.commandName}`)} />
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span class="close" onclick={closeClicked}>
                    <HoverIcon>
                        <Close size={"1em"} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </span>
            </div>
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
        <div class="countdown">
            <div style={`width: ${perc.current}%`} class="bar"></div>
        </div>
    </div>
{/if}

<style lang="scss">
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: $sp3;
        margin-bottom: $sp4;

        .title {
            flex: auto;
            @include font(bold, normal, fs-110);
        }
    }
    .ephemeral-msg {
        width: 100%;

        .content {
            padding: $sp4;
        }
    }

    .countdown {
        height: toRem(10);
        width: 100%;

        .bar {
            height: toRem(10);
            background-color: var(--warn);
        }
    }
</style>

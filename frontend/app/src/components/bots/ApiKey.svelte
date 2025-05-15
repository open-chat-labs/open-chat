<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import {
        botActionScopeFromExecutionContext,
        i18nKey,
        OpenChat,
        type ChatIdentifier,
        type CommunityIdentifier,
        type ExternalBotLike,
    } from "openchat-client";
    import { getContext } from "svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import Send from "svelte-material-icons/Send.svelte";
    import Tooltip from "../tooltip/Tooltip.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        botExecutionContext: CommunityIdentifier | ChatIdentifier;
        bot: ExternalBotLike;
        apiKey: string;
    }

    let { botExecutionContext, bot, apiKey }: Props = $props();

    let allowSend = $derived(bot.definition.autonomousConfig?.syncApiKey ?? false);

    function onCopy() {
        navigator.clipboard.writeText(apiKey);
    }

    function sendApiKeyToBot() {
        client
            .executeBotCommand(botActionScopeFromExecutionContext(botExecutionContext), {
                kind: "external_bot",
                id: bot.id,
                endpoint: bot.endpoint,
                command: {
                    name: "sync_api_key",
                    arguments: [{ name: "api_key", kind: "string", value: apiKey }],
                },
            })
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast(i18nKey("bots.add.sendToBotFailed"));
                } else {
                    toastStore.showSuccessToast(i18nKey("bots.add.sendToBotSucceeded"));
                }
            });
    }
</script>

<div class="key">
    <pre>{apiKey}</pre>
</div>
<div class="icons">
    {#if allowSend}
        <Tooltip position={"top"} align={"middle"}>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div role="button" tabindex="0" class="icon" onclick={sendApiKeyToBot}>
                <Send size={$iconSize} color={"var(--icon-txt)"} />
            </div>
            {#snippet popupTemplate()}
                <Translatable resourceKey={i18nKey("bots.add.sendToBot")} />
            {/snippet}
        </Tooltip>
    {/if}
    <Tooltip position={"top"} align={"middle"}>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div role="button" tabindex="0" class="icon" onclick={onCopy}>
            <CopyIcon size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        {#snippet popupTemplate()}
            <Translatable resourceKey={i18nKey("copy")} />
        {/snippet}
    </Tooltip>
</div>

<style lang="scss">
    .icons {
        margin-top: $sp3;
        margin-bottom: $sp3;
        display: flex;
        justify-content: flex-end;
        gap: $sp4;
        .icon {
            cursor: pointer;
            transition: transform 0.2s ease;

            &:active {
                transform: scale(0.8);
            }
        }
    }
    .key {
        display: flex;
        gap: $sp2;
        align-items: center;
        width: 100%;

        pre {
            word-break: break-all;
            flex: 1;
            overflow-wrap: break-word;
            white-space: pre-wrap;
            margin: 0;
            color: var(--warn);
            @include font(book, normal, fs-80);
            @include clamp(2);
        }
    }
</style>

<script lang="ts">
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import Send from "svelte-material-icons/Send.svelte";
    import { _ } from "svelte-i18n";
    import {
        botActionScopeFromExecutionContext,
        i18nKey,
        OpenChat,
        type ChatIdentifier,
        type CommunityIdentifier,
        type ExternalBotLike,
    } from "openchat-client";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import { iconSize } from "@src/stores/iconSize";
    import TooltipPopup from "../TooltipPopup.svelte";
    import Translatable from "../Translatable.svelte";
    import { getContext } from "svelte";
    import { toastStore } from "@src/stores/toast";

    const client = getContext<OpenChat>("client");

    interface Props {
        botExecutionContext: CommunityIdentifier | ChatIdentifier;
        bot: ExternalBotLike;
        apiKey: string;
        truncate: boolean;
    }

    let { botExecutionContext, bot, apiKey, truncate }: Props = $props();

    function onCopy() {
        navigator.clipboard.writeText(apiKey);
    }

    function sendApiKeyToBot() {
        client
            .executeBotCommand(
                botActionScopeFromExecutionContext($state.snapshot(botExecutionContext)),
                {
                    kind: "external_bot",
                    id: bot.id,
                    endpoint: bot.endpoint,
                    command: {
                        name: "sync_api_key",
                        params: [{ name: "api_key", kind: "string", value: apiKey }],
                    },
                },
            )
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
    <pre class:truncate>{apiKey}</pre>
</div>
<div class="icons">
    <TooltipWrapper position={"top"} align={"middle"}>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div role="button" tabindex="0" slot="target" class="icon" onclick={onCopy}>
            <CopyIcon size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div let:position let:align slot="tooltip">
            <TooltipPopup {position} {align} textLength={100} longestWord={10}>
                <Translatable resourceKey={i18nKey("copy")} />
            </TooltipPopup>
        </div>
    </TooltipWrapper>
    <TooltipWrapper position={"top"} align={"middle"}>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div role="button" tabindex="0" slot="target" class="icon" onclick={sendApiKeyToBot}>
            <Send size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div let:position let:align slot="tooltip">
            <TooltipPopup {position} {align} textLength={100} longestWord={10}>
                <Translatable resourceKey={i18nKey("bots.add.sendToBot")} />
            </TooltipPopup>
        </div>
    </TooltipWrapper>
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

            &.truncate {
                @include clamp(2);
            }
        }
    }
</style>

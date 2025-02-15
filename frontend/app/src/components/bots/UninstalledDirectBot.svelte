<script lang="ts">
    import page from "page";
    import {
        chatIdentifiersEqual,
        emptyExternalBotPermissions,
        externalBots,
        flattenCommandPermissions,
        OpenChat,
        chatListScopeStore as chatListScope,
        type BotSummaryMode,
        type DirectChatIdentifier,
    } from "openchat-client";
    import BotSummary from "./BotSummary.svelte";
    import { getContext, tick } from "svelte";
    import { pathParams, routeForScope } from "../../routes";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: DirectChatIdentifier;
        botId: string;
    }

    let { botId, chatId }: Props = $props();

    let bot = $derived($externalBots.get(botId));
    let permissions = $derived(
        bot ? flattenCommandPermissions(bot.definition) : emptyExternalBotPermissions(),
    );
    let mode: BotSummaryMode | undefined = $derived.by(() => {
        return bot
            ? {
                  kind: "installing_direct_command_bot",
                  id: chatId,
                  requested: permissions,
                  granted: permissions,
              }
            : undefined;
    });

    function deleteDirectChat() {
        if (
            $pathParams.kind === "global_chat_selected_route" &&
            chatIdentifiersEqual(chatId, $pathParams.chatId)
        ) {
            page(routeForScope($chatListScope));
        }
        tick().then(() => client.removeChat(chatId));
    }
</script>

{#if bot !== undefined && mode !== undefined}
    <BotSummary {bot} {mode} onClose={deleteDirectChat} />
{/if}

<style lang="scss">
</style>

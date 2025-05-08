<script lang="ts">
    import {
        app,
        botState,
        chatIdentifiersEqual,
        OpenChat,
        pathState,
        routeForScope,
        type DirectChatIdentifier,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import BotInstaller from "./install/BotInstaller.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: DirectChatIdentifier;
        botId: string;
        onClose: () => void;
    }

    let { botId, chatId, onClose }: Props = $props();

    let bot = $derived(botState.externalBots.get(botId));

    function closeInstaller(installed: boolean) {
        if (!installed) {
            client.removeChat(chatId);
            if (
                pathState.route.kind === "global_chat_selected_route" &&
                chatIdentifiersEqual(chatId, pathState.route.chatId)
            ) {
                page(routeForScope(app.chatListScope));
            }
        }
        onClose();
    }
</script>

{#if bot !== undefined}
    <BotInstaller
        level={"group"}
        location={{ kind: "direct_chat", userId: app.currentUserId }}
        {bot}
        onClose={closeInstaller}
        installedBots={app.directChatBots} />
{/if}

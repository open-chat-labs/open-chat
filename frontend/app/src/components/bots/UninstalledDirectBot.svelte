<script lang="ts">
    import {
        app,
        botState,
        chatIdentifiersEqual,
        currentUser,
        OpenChat,
        pathState,
        routeForScope,
        type DirectChatIdentifier,
    } from "openchat-client";
    import page from "page";
    import { getContext, tick } from "svelte";
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
            if (
                pathState.route.kind === "global_chat_selected_route" &&
                chatIdentifiersEqual(chatId, pathState.route.chatId)
            ) {
                page(routeForScope(app.chatListScope));
            }
            tick().then(() => client.removeChat(chatId));
        }
        onClose();
    }
</script>

{#if bot !== undefined}
    <BotInstaller
        level={"group"}
        location={{ kind: "direct_chat", userId: $currentUser.userId }}
        {bot}
        onClose={closeInstaller}
        installedBots={app.directChatBots} />
{/if}

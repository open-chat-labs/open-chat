<script lang="ts">
    import { botState, type DirectChatIdentifier } from "openchat-client";

    // const client = getContext<OpenChat>("client");

    interface Props {
        chatId: DirectChatIdentifier;
        botId: string;
        onClose: () => void;
    }

    let { botId }: Props = $props();

    let bot = $derived(botState.externalBots.get(botId));

    // function closeInstaller(installed: boolean) {
    //     if (!installed) {
    //         client.removeChat(chatId);
    //         if (
    //             $routeStore.kind === "global_chat_selected_route" &&
    //             chatIdentifiersEqual(chatId, $routeStore.chatId)
    //         ) {
    //             page(routeForScope($chatListScopeStore));
    //         }
    //     }
    //     onClose();
    // }
</script>

{#if bot !== undefined}
    <!-- <BotInstaller
        level={"group"}
        location={{ kind: "direct_chat", userId: $currentUserIdStore }}
        {bot}
        onClose={closeInstaller}
        installedBots={$directChatBotsStore} /> -->
{/if}

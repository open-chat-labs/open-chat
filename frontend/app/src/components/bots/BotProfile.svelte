<script module lang="ts">
    export interface BotProfileProps {
        botId: string;
        chatId: ChatIdentifier;
        onClose: () => void;
    }
</script>

<script lang="ts">
    import type { ChatIdentifier, CommunityIdentifier, GroupChatIdentifier } from "openchat-client";
    import {
        botState,
        definitionToPermissions,
        emptyGrantedBotPermissions,
        selectedChatBotsStore,
        selectedCommunityBotsStore,
    } from "openchat-client";
    import BotSummary from "./BotSummary.svelte";

    let { botId, chatId, onClose }: BotProfileProps = $props();

    let grantedPermissions = $derived.by(() => {
        if (chatId.kind === "channel") {
            return $selectedCommunityBotsStore.get(botId) ?? emptyGrantedBotPermissions();
        } else {
            return $selectedChatBotsStore.get(botId) ?? emptyGrantedBotPermissions();
        }
    });
    let bot = $derived(botState.externalBots.get(botId));
    let id = $derived.by<CommunityIdentifier | GroupChatIdentifier | undefined>(() => {
        switch (chatId.kind) {
            case "channel":
                return { kind: "community", communityId: chatId.communityId };
            case "group_chat":
                return chatId;
            case "direct_chat":
                return undefined;
        }
    });
</script>

{#if bot !== undefined && id !== undefined}
    <BotSummary
        level={"group"}
        mode={{
            kind: "viewing_bot",
            id,
            requested: definitionToPermissions(bot.definition),
            granted: grantedPermissions,
        }}
        {onClose}
        {bot} />
{/if}

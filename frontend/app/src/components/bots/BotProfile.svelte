<script module lang="ts">
    export interface BotProfileProps {
        botId: string;
        chatId: ChatIdentifier;
        onClose: () => void;
    }
</script>

<script lang="ts">
    import type { ChatIdentifier, CommunityIdentifier, GroupChatIdentifier } from "openchat-client";
    import BotSummary from "./BotSummary.svelte";
    import {
        externalBots,
        currentChatBots,
        currentCommunityBots,
        emptySlashCommandPermissions,
    } from "openchat-client";

    let { botId, chatId, onClose }: BotProfileProps = $props();

    let installedBots = $derived(
        chatId.kind === "channel" ? currentCommunityBots : currentChatBots,
    );
    let grantedPermissions = $derived($installedBots.get(botId) ?? emptySlashCommandPermissions());
    let bot = $derived($externalBots.get(botId));
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
    <BotSummary currentPermissions={grantedPermissions} mode={"viewing"} {id} {onClose} {bot} />
{/if}

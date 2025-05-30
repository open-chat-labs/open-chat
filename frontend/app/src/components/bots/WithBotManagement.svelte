<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import {
        chatListScopeStore,
        chatSummariesListStore,
        currentUserIdStore,
        mobileWidth,
        pageRedirect,
        routeForScope,
        type ChatSummary,
        type CommunitySummary,
        type OpenChat,
    } from "openchat-client";
    import {
        chatIdentifiersEqual,
        definitionToPermissions,
        i18nKey,
        routeForChatIdentifier,
        type BotInstallationLocation,
        type BotSummaryMode,
        type ExternalBot,
        type GrantedBotPermissions,
        type Level,
    } from "openchat-shared";
    import page from "page";
    import { getContext, type Snippet } from "svelte";
    import BotSummary from "./BotSummary.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        collection: CommunitySummary | ChatSummary;
        bot: ExternalBot;
        canManage: boolean;
        grantedPermissions: GrantedBotPermissions;
        contents: Snippet<[BotManagement]>;
    }

    let level: Level = $derived.by(() => {
        switch (collection.kind) {
            case "community":
                return "community";
            case "channel":
                return "channel";
            default:
                return "group";
        }
    });
    let { collection, bot, grantedPermissions, contents }: Props = $props();
    let botSummaryMode = $state<BotSummaryMode | undefined>(undefined);
    let commandContextId = $derived.by<BotInstallationLocation>(() => {
        switch (collection.kind) {
            case "channel":
                return { kind: "community", communityId: collection.id.communityId };
            case "direct_chat":
                return { kind: "direct_chat", userId: $currentUserIdStore };
            case "group_chat":
                return collection.id;
            case "community":
                return collection.id;
        }
    });

    function removeBot() {
        const ctx = commandContextId;
        const botId = bot.id;

        if (commandContextId.kind === "direct_chat") {
            if ($mobileWidth) {
                page(routeForScope($chatListScopeStore));
            } else {
                const first = $chatSummariesListStore.find(
                    (c) => !chatIdentifiersEqual(c.id, { kind: "direct_chat", userId: bot.id }),
                );
                if (first) {
                    pageRedirect(routeForChatIdentifier($chatListScopeStore.kind, first.id));
                } else {
                    page(routeForScope(client.getDefaultScope()));
                }
            }
        }
        client.uninstallBot(ctx, botId).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("bots.manage.removeFailed"));
            }
        });
    }

    function reviewPermissions() {
        botSummaryMode = {
            kind: "editing_bot",
            id: commandContextId,
            requested: definitionToPermissions(bot.definition),
            granted: grantedPermissions,
        };
    }

    function viewBotDetails() {
        botSummaryMode = {
            kind: "viewing_bot",
            id: commandContextId,
            requested: definitionToPermissions(bot.definition),
            granted: grantedPermissions,
        };
    }

    function closeModal() {
        botSummaryMode = undefined;
    }

    type BotManagement = {
        closeModal: () => void;
        viewBotDetails: () => void;
        reviewPermissions: () => void;
        removeBot: () => void;
    };
</script>

{#if botSummaryMode !== undefined}
    <BotSummary {level} mode={botSummaryMode} onClose={closeModal} {bot} />
{/if}

{@render contents({
    closeModal,
    viewBotDetails,
    reviewPermissions,
    removeBot,
})}

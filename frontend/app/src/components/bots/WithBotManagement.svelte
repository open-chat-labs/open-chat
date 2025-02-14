<script lang="ts">
    import {
        flattenCommandPermissions,
        type BotSummaryMode,
        type ExternalBot,
    } from "openchat-shared";
    import { i18nKey } from "../../i18n/i18n";
    import type {
        CommunityIdentifier,
        OpenChat,
        ExternalBotPermissions,
        CommunitySummary,
        PublicApiKeyDetails,
        ChatSummary,
    } from "openchat-client";
    import { getContext, type Snippet } from "svelte";
    import { toastStore } from "../../stores/toast";
    import BotSummary from "./BotSummary.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        collection: CommunitySummary | ChatSummary;
        bot: ExternalBot;
        canManage: boolean;
        grantedPermissions: ExternalBotPermissions;
        apiKey: PublicApiKeyDetails | undefined;
        contents: Snippet<[BotManagement]>;
    }

    let { collection, bot, canManage, grantedPermissions, apiKey, contents }: Props = $props();
    let botSummaryMode = $state<BotSummaryMode | undefined>(undefined);
    let generatingKey = $state(false);
    let autonomousPermissionsEmpty = $derived(
        bot.definition.autonomousConfig === undefined ||
            permissionsAreEmpty(
                filterRequestedPermissions(bot.definition.autonomousConfig.permissions, collection),
            ),
    );
    let canGenerateKey = $derived(canManage && !autonomousPermissionsEmpty);
    let commandContextId = $derived(
        collection.kind === "channel"
            ? ({ kind: "community", communityId: collection.id.communityId } as CommunityIdentifier)
            : collection.id,
    );
    let apiKeyPermissions = $derived(apiKey?.grantedPermissions);

    function permissionsAreEmpty(perm: ExternalBotPermissions): boolean {
        const empty =
            perm.messagePermissions.length === 0 &&
            perm.chatPermissions.length === 0 &&
            perm.communityPermissions.length === 0;
        return empty;
    }

    function filterRequestedPermissions(
        perm: ExternalBotPermissions,
        scope: CommunitySummary | ChatSummary,
    ): ExternalBotPermissions {
        if (scope.kind === "community") {
            // chat & message permissions don't apply at the community level
            return {
                ...perm,
                chatPermissions: [],
                messagePermissions: [],
            };
        } else {
            // community permisisons don't apply at the chat level
            return {
                ...perm,
                communityPermissions: [],
            };
        }
    }

    function removeBot() {
        client.uninstallBot(commandContextId, bot.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("bots.manage.removeFailed"));
            }
        });
    }

    function reviewApiKey() {
        if (bot.definition.autonomousConfig !== undefined && apiKeyPermissions !== undefined) {
            botSummaryMode = {
                kind: "editing_api_key",
                id: collection.id,
                requested: bot.definition.autonomousConfig.permissions,
                granted: apiKeyPermissions,
            };
            generatingKey = true;
        }
    }

    function reviewCommandPermissions() {
        botSummaryMode = {
            kind: "editing_command_bot",
            id: commandContextId,
            requested: flattenCommandPermissions(bot.definition),
            granted: grantedPermissions,
        };
    }

    function viewBotDetails() {
        botSummaryMode = {
            kind: "viewing_command_bot",
            id: commandContextId,
            requested: flattenCommandPermissions(bot.definition),
            granted: grantedPermissions,
        };
    }

    function closeModal() {
        botSummaryMode = undefined;
        generatingKey = false;
    }

    function generateApiKey() {
        if (bot.definition.autonomousConfig !== undefined) {
            botSummaryMode = {
                kind: "adding_api_key",
                id: collection.id,
                requested: bot.definition.autonomousConfig.permissions,
            };
            generatingKey = true;
        }
    }

    type BotManagement = {
        generateApiKey: () => void;
        closeModal: () => void;
        viewBotDetails: () => void;
        reviewCommandPermissions: () => void;
        reviewApiKey: () => void;
        removeBot: () => void;
        generatingKey: boolean;
        canGenerateKey: boolean;
        apiKeyPermissions: ExternalBotPermissions | undefined;
    };
</script>

{#if botSummaryMode !== undefined}
    <BotSummary mode={botSummaryMode} onClose={closeModal} {bot} />
{/if}

{@render contents({
    generateApiKey,
    closeModal,
    viewBotDetails,
    reviewCommandPermissions,
    reviewApiKey,
    removeBot,
    generatingKey,
    canGenerateKey,
    apiKeyPermissions,
})}

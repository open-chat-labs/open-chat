<script lang="ts">
    import {
        type BotInstallationLocation,
        flattenCommandPermissions,
        type BotSummaryMode,
        type ExternalBot,
        type Level,
    } from "openchat-shared";
    import { i18nKey } from "../../i18n/i18n";
    import {
        type OpenChat,
        type ExternalBotPermissions,
        type CommunitySummary,
        type PublicApiKeyDetails,
        type ChatSummary,
        currentUser,
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
    let commandContextId = $derived.by<BotInstallationLocation>(() => {
        switch (collection.kind) {
            case "channel":
                return { kind: "community", communityId: collection.id.communityId };
            case "direct_chat":
                return { kind: "direct_chat", userId: $currentUser.userId };
            case "group_chat":
                return collection.id;
            case "community":
                return collection.id;
        }
    });
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
        if (scope.kind !== "community") {
            // community permisisons don't apply at the chat level
            return {
                ...perm,
                communityPermissions: [],
            };
        }
        return perm;
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
            const requested = bot.definition.autonomousConfig.permissions;
            client.getApiKey(collection.id, bot.id).then((apiKey) => {
                botSummaryMode = {
                    kind: "editing_api_key",
                    id: collection.id,
                    requested,
                    granted: apiKeyPermissions,
                    apiKey,
                };
                generatingKey = true;
            });
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
    <BotSummary {level} mode={botSummaryMode} onClose={closeModal} {bot} />
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

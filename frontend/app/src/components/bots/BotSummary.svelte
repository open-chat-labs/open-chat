<script lang="ts">
    import {
        OpenChat,
        type CommunityIdentifier,
        type BotSummaryMode,
        type ExternalBotPermissions,
        type BotInstallationLocation,
        type ChatIdentifier,
        type Level,
        type ExternalBotLike,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { toastStore } from "../../stores/toast";
    import ShowApiKeyModal from "./ShowApiKeyModal.svelte";
    import AreYouSure from "../AreYouSure.svelte";
    import ChoosePermissions from "./install/ChoosePermissions.svelte";
    import BotProperties from "./install/BotProperties.svelte";
    import Legend from "../Legend.svelte";
    import ApiKey from "./ApiKey.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        level: Level;
        mode: BotSummaryMode;
        bot: ExternalBotLike;
        onClose: () => void;
    }

    let { bot, onClose, mode, level }: Props = $props();
    let busy = $state(false);
    let title = $derived.by(() => {
        switch (mode.kind) {
            case "editing_command_bot":
                return i18nKey("bots.edit.title");
            case "viewing_command_bot":
                return i18nKey("bots.view.title");
            case "adding_api_key":
                return i18nKey("bots.manage.generateApiKey");
            case "editing_api_key":
                return i18nKey("bots.manage.reviewApiKey");
        }
    });
    let cta = $derived.by(() => {
        switch (mode.kind) {
            case "editing_command_bot":
                return i18nKey("bots.edit.updateBot");
            case "viewing_command_bot":
                return i18nKey("bots.view.close");
            case "adding_api_key":
                return i18nKey("bots.manage.generate");
            case "editing_api_key":
                return i18nKey("bots.manage.regenerate");
        }
    });
    let showCommands = $derived(mode.kind !== "adding_api_key" && mode.kind !== "editing_api_key");
    let choosePermissions = $derived(mode.kind !== "viewing_command_bot");
    let grantedPermissions = $state(getInitialGrantedPermissions(mode));
    let newApiKey = $state<string | undefined>(undefined);
    let currentApiKey = $state<string | undefined>(getExistingApiKey(mode));
    let confirmingRegeneration = $state(false);

    function getExistingApiKey(mode: BotSummaryMode): string | undefined {
        if (mode.kind === "editing_api_key") {
            return mode.apiKey;
        }
    }

    function getInitialGrantedPermissions(mode: BotSummaryMode): ExternalBotPermissions {
        switch (mode.kind) {
            case "editing_command_bot":
            case "editing_api_key":
            case "viewing_command_bot":
                return mode.granted;
            default:
                return mode.requested;
        }
    }

    function updateBot(id: BotInstallationLocation) {
        busy = true;
        client
            .updateInstalledBot($state.snapshot(id), bot.id, $state.snapshot(grantedPermissions))
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("bots.edit.failure"));
                } else {
                    onClose();
                }
            })
            .finally(() => (busy = false));
    }

    function generateApiKey(
        id: CommunityIdentifier | ChatIdentifier,
    ): (confirmed: boolean) => Promise<void> {
        return (confirmed: boolean) => {
            if (!confirmingRegeneration && !confirmed) {
                confirmingRegeneration = true;
                return Promise.resolve();
            }

            if (confirmed) {
                if (bot.definition.autonomousConfig !== undefined) {
                    busy = true;
                    client
                        .generateBotApiKey(
                            $state.snapshot(id),
                            bot.id,
                            $state.snapshot(grantedPermissions),
                        )
                        .then((resp) => {
                            if (resp.kind === "success") {
                                newApiKey = currentApiKey = resp.apiKey;
                            } else {
                                toastStore.showFailureToast(i18nKey("bots.manage.generateFailed"));
                            }
                        })
                        .finally(() => (busy = false));
                }
            }
            confirmingRegeneration = false;
            return Promise.resolve();
        };
    }

    function mainButton() {
        switch (mode.kind) {
            case "editing_command_bot":
                updateBot(mode.id);
                break;
            case "viewing_command_bot":
                onClose();
                break;
            case "adding_api_key":
                generateApiKey(mode.id)(true);
                break;
            case "editing_api_key":
                generateApiKey(mode.id)(false);
                break;
        }
    }
</script>

{#if confirmingRegeneration && (mode.kind === "adding_api_key" || mode.kind === "editing_api_key")}
    <AreYouSure
        message={i18nKey("bots.manage.regenerateWarning")}
        action={generateApiKey(mode.id)} />
{/if}

{#if newApiKey !== undefined}
    <ShowApiKeyModal botExecutionContext={mode.id} {bot} apiKey={newApiKey} {onClose}
    ></ShowApiKeyModal>
{/if}

<Overlay dismissible>
    <ModalContent closeIcon on:close={onClose}>
        <div class="header" slot="header">
            <Translatable resourceKey={title}></Translatable>
        </div>
        <div class="body" slot="body">
            <BotProperties
                {bot}
                installing={busy}
                {showCommands}
                grantedCommandPermissions={grantedPermissions}>
                {#if currentApiKey !== undefined}
                    <Legend large label={i18nKey("bots.manage.currentApiKey")}></Legend>
                    <ApiKey {bot} botExecutionContext={mode.id} apiKey={currentApiKey}></ApiKey>
                {/if}
                {#if choosePermissions}
                    <ChoosePermissions
                        {level}
                        title={i18nKey("bots.add.choosePermissions")}
                        subtitle={i18nKey("bots.add.permissionsInfo")}
                        granted={grantedPermissions}
                        requested={mode.requested} />
                {/if}
            </BotProperties>
        </div>
        <div class="footer" slot="footer">
            <ButtonGroup>
                <Button secondary small={!$mobileWidth} tiny={$mobileWidth} on:click={onClose}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </Button>
                <Button
                    on:click={mainButton}
                    loading={busy}
                    disabled={busy}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}>
                    <Translatable resourceKey={cta} />
                </Button>
            </ButtonGroup>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
    .body {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px;
    }
</style>

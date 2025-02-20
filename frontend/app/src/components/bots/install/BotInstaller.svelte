<script lang="ts">
    import {
        type AutonomousBotConfig,
        botActionScopeFromInstallLocation,
        type BotInstallationLocation,
        emptyExternalBotPermissions,
        type ExternalBot,
        type ExternalBotLike,
        type ExternalBotPermissions,
        externalBots,
        flattenCommandPermissions,
        type Level,
        OpenChat,
        type ResourceKey,
    } from "openchat-client";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import BotProperties from "./BotProperties.svelte";
    import ChoosePermissions from "./ChoosePermissions.svelte";
    import EnableAutonomousAccess from "./EnableAutonomousAccess.svelte";
    import { getContext } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import ShowApiKey from "../ShowApiKey.svelte";

    const client = getContext<OpenChat>("client");

    type Step =
        | { kind: "choose_command_permissions" }
        | { kind: "configure_autonomous_access"; config: AutonomousBotConfig }
        | { kind: "choose_autonomous_permissions"; config: AutonomousBotConfig }
        | { kind: "show_api_key"; apiKey: string; config: AutonomousBotConfig }
        | { kind: "unknown" };

    interface Props {
        location: BotInstallationLocation;
        level: Level;
        bot: ExternalBotLike;
        onClose: (installed: boolean) => void;
        installedBots: Map<string, ExternalBotPermissions>;
    }

    let { location, bot, onClose, level, installedBots }: Props = $props();
    let requestedCommandPermissions = $derived(flattenCommandPermissions(bot.definition));
    let grantedCommandPermissions = $state(flattenCommandPermissions(bot.definition));
    let requestedAutonomousPermissions = $derived(
        bot.definition.autonomousConfig?.permissions ?? emptyExternalBotPermissions(),
    );
    let grantedAutonomousPermission = $state(
        bot.definition.autonomousConfig?.permissions ?? emptyExternalBotPermissions(),
    );
    let busy = $state(false);
    let step = $state<Step>(firstStep());
    let registeredBot: ExternalBot | undefined = $derived($externalBots.get(bot.id));

    function firstStep(): Step {
        if (bot.definition.commands.length > 0) {
            return { kind: "choose_command_permissions" };
        } else if (bot.definition.autonomousConfig !== undefined) {
            return { kind: "configure_autonomous_access", config: bot.definition.autonomousConfig };
        } else {
            return { kind: "unknown" };
        }
    }

    function nextStep(current: Step) {
        switch (current.kind) {
            case "choose_command_permissions":
                install(() => {
                    if (bot.definition.autonomousConfig !== undefined) {
                        step = {
                            kind: "configure_autonomous_access",
                            config: bot.definition.autonomousConfig,
                        };
                    } else {
                        onClose(true);
                    }
                });
                break;
            case "configure_autonomous_access":
                step = { kind: "choose_autonomous_permissions", config: current.config };
                break;
            case "choose_autonomous_permissions":
                generateApiKey((apiKey: string) => {
                    step = { kind: "show_api_key", apiKey, config: current.config };
                });
                break;
            case "show_api_key":
                onClose(true);
                break;
        }
    }

    function sendApiKeyToBot(apiKey: string) {
        client
            .executeBotCommand(botActionScopeFromInstallLocation(location), {
                kind: "external_bot",
                id: bot.id,
                endpoint: registeredBot?.endpoint ?? "",
                command: {
                    name: "sync_api_key",
                    params: [{ name: "api_key", kind: "string", value: apiKey }],
                },
            })
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast(i18nKey("bots.add.sendToBotFailed"));
                } else {
                    toastStore.showSuccessToast(i18nKey("bots.add.sendToBotSucceeded"));
                }
            });
    }

    function generateApiKey(then?: (apiKey: string) => void) {
        if (bot.definition.autonomousConfig !== undefined) {
            busy = true;
            client
                .generateBotApiKey(location, bot.id, $state.snapshot(grantedAutonomousPermission))
                .then((resp) => {
                    if (resp.kind === "success") {
                        then?.(resp.apiKey);
                    } else {
                        toastStore.showFailureToast(i18nKey("bots.manage.generateFailed"));
                    }
                })
                .finally(() => (busy = false));
        }
    }

    function install(then?: () => void) {
        if (installedBots.has(bot.id)) {
            if (then) {
                then();
            } else {
                onClose(true);
            }
        } else {
            busy = true;
            client
                .installBot(location, bot.id, $state.snapshot(grantedCommandPermissions))
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("bots.add.failure"));
                    } else {
                        if (then) {
                            then();
                        } else {
                            onClose(true);
                        }
                    }
                })
                .finally(() => (busy = false));
        }
    }
</script>

<Overlay dismissible>
    <ModalContent closeIcon on:close={() => onClose(false)}>
        <div class="header" slot="header">
            <Translatable resourceKey={i18nKey("bots.add.title", undefined, level, true)}
            ></Translatable>
        </div>
        <div class="body" slot="body">
            <BotProperties installing={busy} {grantedCommandPermissions} {bot}>
                <hr class="separator" />
                {#if step.kind === "choose_command_permissions"}
                    <ChoosePermissions
                        {level}
                        title={i18nKey("bots.add.chooseCommandPermissions")}
                        subtitle={i18nKey("bots.add.commandPermissionsInfo")}
                        bind:granted={grantedCommandPermissions}
                        requested={requestedCommandPermissions} />
                {:else if step.kind === "configure_autonomous_access"}
                    <EnableAutonomousAccess {level} />
                {:else if step.kind === "choose_autonomous_permissions"}
                    <ChoosePermissions
                        {level}
                        title={i18nKey("bots.add.chooseAutonomousPermissions")}
                        subtitle={i18nKey("bots.add.autonomousPermissionsInfo")}
                        bind:granted={grantedAutonomousPermission}
                        requested={requestedAutonomousPermissions} />
                {:else if step.kind === "show_api_key"}
                    <ShowApiKey {bot} botExecutionContext={location} apiKey={step.apiKey} />
                {/if}
            </BotProperties>
        </div>
        <div class="footer" slot="footer">
            <ButtonGroup>
                {#if step.kind === "configure_autonomous_access"}
                    {@render button(i18nKey("bots.add.skip"), () => onClose(true), true)}
                    {@render button(i18nKey("bots.add.configureNow"), () => nextStep(step))}
                {:else if step.kind === "choose_autonomous_permissions"}
                    {@render button(i18nKey("bots.add.generateApiKey"), () => nextStep(step))}
                {:else if step.kind === "show_api_key"}
                    {@const apiKey = step.apiKey}
                    {#if step.config.syncApiKey}
                        {@render button(
                            i18nKey("bots.add.sendToBot"),
                            () => sendApiKeyToBot(apiKey),
                            true,
                            false,
                            false,
                        )}
                    {/if}
                    {@render button(i18nKey("bots.add.continue"), () => nextStep(step))}
                {:else}
                    {@render button(i18nKey("bots.add.install"), () => nextStep(step))}
                {/if}
            </ButtonGroup>
        </div>
    </ModalContent>
</Overlay>

{#snippet button(
    txt: ResourceKey,
    click: () => void,
    secondary = false,
    disabled = busy,
    loading = busy,
)}
    <Button
        {secondary}
        small={!$mobileWidth}
        tiny={$mobileWidth}
        {disabled}
        {loading}
        on:click={click}>
        <Translatable resourceKey={txt} />
    </Button>
{/snippet}

<style lang="scss">
    .body {
        display: flex;
        justify-content: center;
        gap: 12px;
        flex-direction: column;
    }

    .separator {
        color: var(--txt-light);
        margin-bottom: $sp3;
    }
</style>

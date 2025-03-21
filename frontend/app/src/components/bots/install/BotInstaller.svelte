<script lang="ts">
    import {
        type AutonomousBotConfig,
        type BotInstallationLocation,
        emptyExternalBotPermissions,
        type ExternalBotLike,
        type ExternalBotPermissions,
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
    let botExecutionContext = $derived.by(() => {
        switch (location.kind) {
            case "direct_chat":
                // for direct chat, the execution context is the bot's id, the install location is *our* userId
                return { ...location, userId: bot.id };
            default:
                return location;
        }
    });

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
                busy = true;
                install(() => {
                    if (bot.definition.autonomousConfig !== undefined) {
                        step = {
                            kind: "configure_autonomous_access",
                            config: bot.definition.autonomousConfig,
                        };
                        busy = false;
                    } else {
                        onClose(true);
                    }
                });
                break;
            case "configure_autonomous_access":
                step = { kind: "choose_autonomous_permissions", config: current.config };
                break;
            case "choose_autonomous_permissions":
                busy = true;
                install(() => {
                    generateApiKey((apiKey: string) => {
                        step = { kind: "show_api_key", apiKey, config: current.config };
                    });
                });
                break;
            case "show_api_key":
                onClose(true);
                break;
        }
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
                });
        }
    }
</script>

<Overlay dismissible onClose={() => onClose(false)}>
    <ModalContent closeIcon onClose={() => onClose(false)}>
        {#snippet header()}
            <div class="header">
                <Translatable resourceKey={i18nKey("bots.add.title", undefined, level, true)}
                ></Translatable>
            </div>
        {/snippet}
        {#snippet body()}
            <div class="body">
                <BotProperties installing={busy} {grantedCommandPermissions} {bot}>
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
                        <ShowApiKey {bot} {botExecutionContext} apiKey={step.apiKey} />
                    {/if}
                </BotProperties>
            </div>
        {/snippet}
        {#snippet footer()}
            <div class="footer">
                <ButtonGroup>
                    {#if step.kind === "configure_autonomous_access"}
                        {@render button(i18nKey("bots.add.skip"), () => onClose(true), true)}
                        {@render button(i18nKey("bots.add.configureNow"), () => nextStep(step))}
                    {:else if step.kind === "choose_autonomous_permissions"}
                        {@render button(i18nKey("bots.add.generateApiKey"), () => nextStep(step))}
                    {:else if step.kind === "show_api_key"}
                        {@render button(i18nKey("bots.add.continue"), () => nextStep(step))}
                    {:else}
                        {@render button(i18nKey("bots.add.install"), () => nextStep(step))}
                    {/if}
                </ButtonGroup>
            </div>
        {/snippet}
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
</style>

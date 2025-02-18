<script lang="ts">
    import {
        type BotInstallationLocation,
        type BotMatch,
        emptyExternalBotPermissions,
        type ExternalBot,
        type ExternalBotPermissions,
        flattenCommandPermissions,
        type Level,
        OpenChat,
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
    import ErrorMessage from "@src/components/ErrorMessage.svelte";
    import EnableAutonomousAccess from "./EnableAutonomousAccess.svelte";
    import { getContext } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import ShowApiKey from "../ShowApiKey.svelte";
    import SubscribeBlurb from "./SubscribeBlurb.svelte";

    const client = getContext<OpenChat>("client");

    type Step =
        | "choose_command_permissions"
        | "configure_autonomous_access"
        | "choose_autonomous_permissions"
        | "subscribe_info"
        | "subscribing"
        | "show_api_key"
        | "error";

    interface Props {
        location: BotInstallationLocation;
        level: Level;
        bot: BotMatch | ExternalBot;
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
    let apiKey = $state<string | undefined>(undefined);

    function firstStep() {
        if (bot.definition.commands.length > 0) {
            return "choose_command_permissions";
        } else {
            return "error";
        }
    }

    function nextStep(current: Step) {
        switch (current) {
            case "choose_command_permissions":
                if (bot.definition.autonomousConfig !== undefined) {
                    step = "configure_autonomous_access";
                } else {
                    install();
                }
                break;
            case "configure_autonomous_access":
                install(() => {
                    step = "choose_autonomous_permissions";
                });
                break;
            case "choose_autonomous_permissions":
                generateApiKey(() => {
                    step = "show_api_key";
                });
                break;
            case "show_api_key":
                step = "subscribe_info";
                break;
            case "subscribe_info":
                step = "subscribing";
                break;
            case "error":
            default:
                step = "error";
                break;
        }
    }

    function generateApiKey(andThen?: () => void) {
        if (bot.definition.autonomousConfig !== undefined) {
            busy = true;
            client
                .generateBotApiKey(location, bot.id, $state.snapshot(grantedAutonomousPermission))
                .then((resp) => {
                    if (resp.kind === "success") {
                        apiKey = resp.apiKey;
                        andThen?.();
                    } else {
                        toastStore.showFailureToast(i18nKey("bots.manage.generateFailed"));
                    }
                })
                .finally(() => (busy = false));
        }
    }

    function install(andThen?: () => void) {
        if (installedBots.has(bot.id)) {
            onClose(true);
        } else {
            busy = true;
            client
                .installBot(location, bot.id, $state.snapshot(grantedCommandPermissions))
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("bots.add.failure"));
                    } else {
                        if (andThen) {
                            andThen();
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
                {#if step === "choose_command_permissions"}
                    <ChoosePermissions
                        {level}
                        title={i18nKey("bots.add.chooseCommandPermissions")}
                        subtitle={i18nKey("bots.add.commandPermissionsInfo")}
                        bind:granted={grantedCommandPermissions}
                        requested={requestedCommandPermissions} />
                {:else if step === "configure_autonomous_access"}
                    <EnableAutonomousAccess {level} />
                {:else if step === "choose_autonomous_permissions"}
                    <ChoosePermissions
                        {level}
                        title={i18nKey("bots.add.chooseAutonomousPermissions")}
                        subtitle={i18nKey("bots.add.autonomousPermissionsInfo")}
                        bind:granted={grantedAutonomousPermission}
                        requested={requestedAutonomousPermissions} />
                {:else if step === "show_api_key" && apiKey !== undefined}
                    <ShowApiKey {apiKey} />
                {:else if step === "subscribe_info"}
                    <SubscribeBlurb />
                {:else if step === "subscribing"}
                    <h1>Subscribing</h1>
                {:else if step === "error"}
                    <ErrorMessage>
                        <h1>Oh no something is wrong</h1>
                    </ErrorMessage>
                {/if}
            </BotProperties>
        </div>
        <div class="footer" slot="footer">
            <ButtonGroup>
                {#if step === "configure_autonomous_access"}
                    <Button
                        disabled={busy}
                        loading={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => install()}>
                        <Translatable resourceKey={i18nKey("bots.add.skipAndInstall")} />
                    </Button>
                    <Button
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        disabled={busy}
                        on:click={() => nextStep(step)}>
                        <Translatable resourceKey={i18nKey("bots.add.configureNow")} />
                    </Button>
                {:else if step === "choose_autonomous_permissions"}
                    <Button
                        disabled={busy}
                        loading={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => nextStep(step)}>
                        <Translatable resourceKey={i18nKey("bots.add.generateApiKey")} />
                    </Button>
                {:else if step === "subscribe_info"}
                    <Button
                        disabled={busy}
                        loading={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => nextStep(step)}>
                        <Translatable resourceKey={i18nKey("bots.add.subscribe")} />
                    </Button>
                    <Button
                        disabled={busy}
                        loading={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => onClose(true)}>
                        <Translatable resourceKey={i18nKey("bots.add.skipAndInstall")} />
                    </Button>
                {:else}
                    <Button
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        disabled={busy}
                        loading={busy}
                        on:click={() => nextStep(step)}>
                        <Translatable resourceKey={i18nKey("bots.add.continue")} />
                    </Button>
                {/if}
            </ButtonGroup>
        </div>
    </ModalContent>
</Overlay>

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

<script lang="ts">
    import {
        type BotInstallationLocation,
        definitionToPermissions,
        type ExternalBotLike,
        type GrantedBotPermissions,
        type Level,
        mobileWidth,
        OpenChat,
        type ReadonlyMap,
        type ResourceKey,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
    import BotProperties from "./BotProperties.svelte";
    import ChoosePermissions from "./ChoosePermissions.svelte";

    const client = getContext<OpenChat>("client");

    type Step = "choose_command_permissions" | "choose_autonomous_permissions" | "unknown";

    interface Props {
        location: BotInstallationLocation;
        level: Level;
        bot: ExternalBotLike;
        onClose: (installed: boolean) => void;
        installedBots: ReadonlyMap<string, GrantedBotPermissions>;
    }

    let { location, bot, onClose, level, installedBots }: Props = $props();
    let requestedPermissions = $derived(definitionToPermissions(bot.definition));
    let grantedPermissions = $state(definitionToPermissions(bot.definition));

    let busy = $state(false);
    let step = $state<Step>(firstStep());

    function firstStep(): Step {
        if (bot.definition.commands.length > 0) {
            return "choose_command_permissions";
        } else if (bot.definition.autonomousConfig !== undefined) {
            return "choose_autonomous_permissions";
        } else {
            return "unknown";
        }
    }

    function nextStep(current: Step) {
        switch (current) {
            case "choose_command_permissions":
                if (bot.definition.autonomousConfig !== undefined) {
                    step = "choose_autonomous_permissions";
                } else {
                    busy = true;
                    install(() => onClose(true));
                }
                break;
            case "choose_autonomous_permissions":
                busy = true;
                install();
                break;
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
                .installBot(location, bot.id, {
                    command: grantedPermissions.command,
                    autonomous: grantedPermissions.autonomous,
                })
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
                <BotProperties installing={busy} {grantedPermissions} {bot}>
                    {#if step === "choose_command_permissions"}
                        <ChoosePermissions
                            {level}
                            title={i18nKey("bots.add.chooseCommandPermissions")}
                            subtitle={i18nKey("bots.add.commandPermissionsInfo")}
                            bind:granted={grantedPermissions.command}
                            requested={requestedPermissions.command} />
                    {:else if step === "choose_autonomous_permissions"}
                        <ChoosePermissions
                            {level}
                            title={i18nKey("bots.add.chooseAutonomousPermissions")}
                            subtitle={i18nKey("bots.add.autonomousPermissionsInfo")}
                            bind:granted={grantedPermissions.autonomous!}
                            requested={requestedPermissions.autonomous!} />
                    {/if}
                </BotProperties>
            </div>
        {/snippet}
        {#snippet footer()}
            <div class="footer">
                <ButtonGroup>
                    {#if step === "choose_command_permissions" && bot.definition.autonomousConfig !== undefined}
                        {@render button(i18nKey("bots.add.next"), () => nextStep(step))}
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
        onClick={click}>
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

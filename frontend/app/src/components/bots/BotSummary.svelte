<script lang="ts">
    import {
        mobileWidth,
        OpenChat,
        type BotInstallationLocation,
        type BotSummaryMode,
        type ExternalBotLike,
        type Level,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Translatable from "../Translatable.svelte";
    import BotProperties from "./install/BotProperties.svelte";
    import ChoosePermissions from "./install/ChoosePermissions.svelte";

    const client = getContext<OpenChat>("client");

    type Step = "choose_command_permissions" | "choose_autonomous_permissions" | "unknown";

    interface Props {
        level: Level;
        mode: BotSummaryMode;
        bot: ExternalBotLike;
        onClose: () => void;
    }

    let { bot, onClose, mode, level }: Props = $props();
    let busy = $state(false);
    let step = $state<Step>(firstStep());
    let title = $derived.by(() => {
        switch (mode.kind) {
            case "editing_bot":
                return i18nKey("bots.edit.title");
            case "viewing_bot":
                return i18nKey("bots.view.title");
        }
    });
    let cta = $derived.by(() => {
        switch (mode.kind) {
            case "editing_bot":
                if (
                    step === "choose_command_permissions" &&
                    bot.definition.autonomousConfig !== undefined
                ) {
                    return i18nKey("bots.edit.next");
                } else {
                    return i18nKey("bots.edit.updateBot");
                }
            case "viewing_bot":
                return i18nKey("bots.view.close");
        }
    });
    let grantedPermissions = $state(mode.granted);

    function firstStep(): Step {
        if (mode.kind === "editing_bot") {
            if (bot.definition.commands.length > 0) {
                return "choose_command_permissions";
            } else if (bot.definition.autonomousConfig !== undefined) {
                return "choose_autonomous_permissions";
            }
        }
        return "unknown";
    }

    function nextStep(current: Step) {
        switch (current) {
            case "choose_command_permissions":
                if (bot.definition.autonomousConfig !== undefined) {
                    step = "choose_autonomous_permissions";
                } else {
                    updateBot(mode.id);
                }
                break;
            case "choose_autonomous_permissions":
                updateBot(mode.id);
                break;
        }
    }

    function updateBot(id: BotInstallationLocation) {
        busy = true;
        client
            .updateInstalledBot(id, bot.id, grantedPermissions)
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("bots.edit.failure"));
                } else {
                    onClose();
                }
            })
            .finally(() => (busy = false));
    }

    function mainButton() {
        switch (mode.kind) {
            case "editing_bot":
                nextStep(step);
                break;
            case "viewing_bot":
                onClose();
                break;
        }
    }
</script>

<Overlay dismissible {onClose}>
    <ModalContent closeIcon {onClose}>
        {#snippet header()}
            <div class="header">
                <Translatable resourceKey={title}></Translatable>
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
                            requested={mode.requested.command} />
                    {:else if step === "choose_autonomous_permissions"}
                        <ChoosePermissions
                            {level}
                            title={i18nKey("bots.add.chooseAutonomousPermissions")}
                            subtitle={i18nKey("bots.add.autonomousPermissionsInfo")}
                            bind:granted={grantedPermissions.autonomous!}
                            requested={mode.requested.autonomous!} />
                    {/if}
                </BotProperties>
            </div>
        {/snippet}
        {#snippet footer()}
            <div class="footer">
                <ButtonGroup>
                    <Button secondary small={!$mobileWidth} tiny={$mobileWidth} onClick={onClose}>
                        <Translatable resourceKey={i18nKey("cancel")} />
                    </Button>
                    <Button
                        onClick={mainButton}
                        loading={busy}
                        disabled={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}>
                        <Translatable resourceKey={cta} />
                    </Button>
                </ButtonGroup>
            </div>
        {/snippet}
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

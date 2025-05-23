<script lang="ts">
    import {
        mobileWidth,
        OpenChat,
        type BotInstallationLocation,
        type BotSummaryMode,
        type ExternalBotLike,
        type ExternalBotPermissions,
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
        }
    });
    let cta = $derived.by(() => {
        switch (mode.kind) {
            case "editing_command_bot":
                return i18nKey("bots.edit.updateBot");
            case "viewing_command_bot":
                return i18nKey("bots.view.close");
        }
    });
    let choosePermissions = $derived(mode.kind !== "viewing_command_bot");
    let grantedPermissions = $state(getInitialGrantedPermissions(mode));

    function getInitialGrantedPermissions(mode: BotSummaryMode): ExternalBotPermissions {
        switch (mode.kind) {
            case "editing_command_bot":
            case "viewing_command_bot":
                return mode.granted;
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
            case "editing_command_bot":
                updateBot(mode.id);
                break;
            case "viewing_command_bot":
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
                <BotProperties
                    {bot}
                    installing={busy}
                    showCommands
                    grantedCommandPermissions={grantedPermissions}>
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

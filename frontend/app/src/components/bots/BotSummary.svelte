<script lang="ts">
    import {
        mobileWidth,
        OpenChat,
        type BotSummaryMode,
        type ExternalBotLike,
        type Level,
    } from "@client";
    import { getContext, untrack } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { BotInstall } from "@src/logic/bots/botInstall.svelte";
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
    const form = new BotInstall(
        client,
        untrack(() => bot),
        untrack(() => mode.id),
        untrack(() => mode.granted),
    );
    // Only a bot being edited has permissions to choose
    let step = $derived(mode.kind === "editing_bot" ? form.step : "unknown");
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
                return form.hasNextStep
                    ? i18nKey("bots.edit.next")
                    : i18nKey("bots.edit.updateBot");
            case "viewing_bot":
                return i18nKey("bots.view.close");
        }
    });

    async function mainButton() {
        if (mode.kind === "viewing_bot") {
            onClose();
        } else if (form.hasNextStep) {
            form.next();
        } else {
            const outcome = await form.save();
            switch (outcome.kind) {
                case "installed":
                case "updated":
                    onClose();
                    break;
                case "failed":
                    toastStore.showFailureToast(outcome.message);
                    break;
                default:
                    outcome satisfies never;
            }
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
                <BotProperties installing={form.busy} grantedPermissions={form.grantedPermissions} {bot}>
                    {#if step === "choose_command_permissions"}
                        <ChoosePermissions
                            {level}
                            title={i18nKey("bots.add.chooseCommandPermissions")}
                            subtitle={i18nKey("bots.add.commandPermissionsInfo")}
                            bind:granted={form.grantedPermissions.command}
                            requested={mode.requested.command} />
                    {:else if step === "choose_autonomous_permissions"}
                        <ChoosePermissions
                            {level}
                            title={i18nKey("bots.add.chooseAutonomousPermissions")}
                            subtitle={i18nKey("bots.add.autonomousPermissionsInfo")}
                            bind:granted={form.grantedPermissions.autonomous!}
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
                        loading={form.busy}
                        disabled={form.busy}
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

<script lang="ts">
    import {
        type BotInstallationLocation,
        type ExternalBotLike,
        type GrantedBotPermissions,
        type Level,
        mobileWidth,
        OpenChat,
        type ReadonlyMap,
        type ResourceKey,
    } from "@client";
    import { getContext, untrack } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { BotInstall } from "@shared_components/bots/install/botInstall.svelte";
    import BotProperties from "./BotProperties.svelte";
    import ChoosePermissions from "./ChoosePermissions.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        location: BotInstallationLocation;
        level: Level;
        bot: ExternalBotLike;
        onClose: (installed: boolean) => void;
        installedBots: ReadonlyMap<string, GrantedBotPermissions>;
    }

    let { location, bot, onClose, level, installedBots }: Props = $props();
    const form = new BotInstall(
        client,
        untrack(() => bot),
        untrack(() => location),
    );

    async function nextStep() {
        if (form.hasNextStep) {
            form.next();
            return;
        }
        if (installedBots.has(bot.id)) {
            onClose(true);
            return;
        }
        const outcome = await form.save();
        switch (outcome.kind) {
            case "installed":
            case "updated":
                onClose(true);
                break;
            case "failed":
                toastStore.showFailureToast(outcome.message);
                break;
            default:
                outcome satisfies never;
        }
    }
</script>

<Overlay>
    <ModalContent>
        {#snippet header()}
            <div class="header">
                <Translatable resourceKey={i18nKey("bots.add.title", undefined, level, true)}
                ></Translatable>
            </div>
        {/snippet}
        {#snippet body()}
            <div class="body">
                <BotProperties installing={form.busy} grantedPermissions={form.grantedPermissions} {bot}>
                    {#if form.step === "choose_command_permissions"}
                        <ChoosePermissions
                            {level}
                            title={i18nKey("bots.add.chooseCommandPermissions")}
                            subtitle={i18nKey("bots.add.commandPermissionsInfo")}
                            bind:granted={form.grantedPermissions.command}
                            requested={form.requestedPermissions.command} />
                    {:else if form.step === "choose_autonomous_permissions"}
                        <ChoosePermissions
                            {level}
                            title={i18nKey("bots.add.chooseAutonomousPermissions")}
                            subtitle={i18nKey("bots.add.autonomousPermissionsInfo")}
                            bind:granted={form.grantedPermissions.autonomous!}
                            requested={form.requestedPermissions.autonomous!} />
                    {/if}
                </BotProperties>
            </div>
        {/snippet}
        {#snippet footer()}
            <div class="footer">
                <ButtonGroup>
                    {#if form.hasNextStep}
                        {@render button(i18nKey("bots.add.next"), nextStep)}
                    {:else}
                        {@render button(i18nKey("cancel"), () => onClose(false), true)}
                        {@render button(i18nKey("bots.add.install"), nextStep)}
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
    disabled = form.busy,
    loading = form.busy,
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

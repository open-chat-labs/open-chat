<script lang="ts">
    import { _ } from "svelte-i18n";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import {
        botActionScopeFromInstallLocation,
        i18nKey,
        OpenChat,
        type BotInstallationLocation,
        type ExternalBotLike,
    } from "openchat-client";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import ShowApiKey from "./ShowApiKey.svelte";
    import { getContext } from "svelte";
    import { toastStore } from "@src/stores/toast";

    const client = getContext<OpenChat>("client");

    interface Props {
        location: BotInstallationLocation;
        bot: ExternalBotLike;
        apiKey: string;
        onClose: () => void;
    }

    let { location, bot, apiKey, onClose }: Props = $props();

    function onCopy() {
        navigator.clipboard.writeText(apiKey);
    }

    function sendApiKeyToBot() {
        client
            .executeBotCommand(botActionScopeFromInstallLocation(location), {
                kind: "external_bot",
                id: bot.id,
                endpoint: bot.endpoint,
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
</script>

<Overlay dismissible>
    <ModalContent closeIcon on:close={onClose}>
        <div class="header" slot="header">
            <Translatable resourceKey={i18nKey("bots.manage.generated")}></Translatable>
        </div>
        <div class="body" slot="body">
            <ShowApiKey {apiKey} />
        </div>
        <div class="footer" slot="footer">
            <ButtonGroup>
                <Button
                    secondary
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={sendApiKeyToBot}>
                    <Translatable resourceKey={i18nKey("bots.add.sendToBot")} />
                </Button>
                <Button secondary small={!$mobileWidth} tiny={$mobileWidth} on:click={onCopy}>
                    <Translatable resourceKey={i18nKey("copy")} />
                </Button>
                <Button on:click={onClose} small={!$mobileWidth} tiny={$mobileWidth}>
                    <Translatable resourceKey={i18nKey("close")} />
                </Button>
            </ButtonGroup>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }
</style>

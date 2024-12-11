<script lang="ts">
    import { currentUser, emptyBotInstance, OpenChat } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import BotBuilder from "./BotBuilder.svelte";
    import Button from "../Button.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { getContext } from "svelte";
    import { toastStore } from "../../stores/toast";
    import ButtonGroup from "../ButtonGroup.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();

    let valid = $state(false);
    let registering = $state(false);

    let bot = $state(emptyBotInstance());

    function register() {
        if (bot !== undefined && valid) {
            registering = true;
            const snapshot = $state.snapshot(bot);
            client
                .registerBot({
                    ...snapshot,
                    id: "yf5kc-uaaaa-aaaar-a7qfq-cai",
                    ownerId: $currentUser.userId,
                })
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("Unable to register test bot"));
                    } else {
                        console.log("Bot registered");
                        onClose();
                    }
                })
                .finally(() => (registering = false));
        }
    }
</script>

<ModalContent on:close={onClose}>
    <div class="header" slot="header">
        <Translatable resourceKey={i18nKey("bots.builder.title")}></Translatable>
    </div>
    <div class="body" slot="body">
        <BotBuilder onUpdate={(b) => (bot = b)} bind:valid />
    </div>
    <div class="footer" slot="footer">
        <ButtonGroup>
            <Button secondary small={!$mobileWidth} tiny={$mobileWidth} on:click={onClose}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </Button>
            <Button
                on:click={register}
                disabled={!valid || registering}
                loading={registering}
                small={!$mobileWidth}
                tiny={$mobileWidth}>
                <Translatable resourceKey={i18nKey("Register")} />
            </Button>
        </ButtonGroup>
    </div>
</ModalContent>

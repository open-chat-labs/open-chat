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

    const client = getContext<OpenChat>("client");

    let valid = $state(false);

    let bot = $state(emptyBotInstance());

    function register() {
        if (bot !== undefined && valid) {
            const snapshot = $state.snapshot(bot);
            client
                .registerBot({
                    ...snapshot,
                    id: $currentUser.userId,
                    ownerId: $currentUser.userId,
                })
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("Unable to register test bot"));
                    }
                });
        }
    }
</script>

<ModalContent on:close>
    <div class="header" slot="header">
        <Translatable resourceKey={i18nKey("bots.builder.title")}></Translatable>
    </div>
    <div class="body" slot="body">
        <BotBuilder onUpdate={(b) => (bot = b)} bind:valid />
    </div>
    <div class="footer" slot="footer" let:onClose>
        <Button
            on:click={register}
            disabled={!valid}
            on:click={onClose}
            small={!$mobileWidth}
            tiny={$mobileWidth}>
            <Translatable resourceKey={i18nKey("Register")} />
        </Button>
    </div>
</ModalContent>

<style lang="scss">
</style>

<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import Button from "../Button.svelte";
    import type { HomeController } from "../../fsm/home.controller";
    import Overlay from "../Overlay.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let controller: HomeController;
    export let chatId: string | undefined;
    export let operation: "leave" | "delete";

    $: confirming = chatId !== undefined;
    $: msgKey = operation === "leave" ? "confirmLeaveGroup" : "irreversible";

    let inProgress = false;

    function confirm() {
        if (chatId === undefined) return;
        inProgress = true;
        const result =
            operation === "leave" ? controller.leaveGroup(chatId) : controller.deleteGroup(chatId);
        result.finally(() => {
            confirming = false;
            chatId = undefined;
            inProgress = false;
            dispatch("removed");
        });
    }
</script>

<Overlay bind:active={confirming}>
    <ModalContent fill={true}>
        <span slot="header">{$_("areYouSure")}</span>
        <span slot="body">
            <p class="confirm-msg">
                {$_(msgKey)}
            </p>
        </span>
        <span slot="footer">
            <div class="buttons">
                <Button loading={inProgress} disabled={inProgress} small={true} on:click={confirm}
                    >{$_("yesPlease")}</Button>
                <Button
                    disabled={inProgress}
                    small={true}
                    on:click={() => {
                        confirming = false;
                        chatId = undefined;
                    }}
                    secondary={true}>{$_("noThanks")}</Button>
            </div>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    .confirm-msg {
        padding: $sp5;
    }

    .buttons {
        display: flex;
        justify-content: flex-end;
        align-items: center;
    }
</style>

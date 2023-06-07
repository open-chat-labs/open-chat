<script lang="ts">
    import { getContext, createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat } from "openchat-client";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import TextArea from "../TextArea.svelte";

    export let userId: string;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let reason: string;
    let suspending = false;
    let showError = false;

    function onSuspend() {
        suspending = true;
        showError = false;
        client.suspendUser(userId, reason).then((success) => {
            if (success) {
                dispatch("close");
            } else {
                showError = true;
            }
            suspending = false;
        });
    }
</script>

<Overlay dismissible on:close>
    <ModalContent on:close>
        <div slot="header">{$_("suspendedUser")}</div>
        <div slot="body">
            <TextArea
                bind:value={reason}
                autofocus
                minlength={3}
                maxlength={512}
                placeholder={$_("reasonForSuspension")}>
                {#if showError}
                    <ErrorMessage>{$_("failedToSuspendUser")}</ErrorMessage>
                {/if}
            </TextArea>
        </div>
        <div slot="footer">
            <ButtonGroup>
                <Button on:click={onSuspend} loading={suspending} small>
                    {$_("suspend")}
                </Button>
                <Button on:click={() => dispatch("close")} disabled={suspending} small secondary>
                    {$_("cancel")}
                </Button>
            </ButtonGroup>
        </div>
    </ModalContent>
</Overlay>

<script lang="ts">
    import type { OpenChat } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import Button from "@src/ui/Button.svelte";
    import ButtonGroup from "@src/ui/ButtonGroup.svelte";
    import ErrorMessage from "@src/desktop/shared/ErrorMessage.svelte";
    import ModalContent from "@src/ui/ModalContent.svelte";
    import Overlay from "@src/ui/Overlay.svelte";
    import TextArea from "@src/desktop/shared/TextArea.svelte";
    import Translatable from "@src/ui/Translatable.svelte";

    interface Props {
        userId: string;
        onClose: () => void;
    }

    let { userId, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    let reason: string = $state("");
    let suspending = $state(false);
    let showError = $state(false);

    function onSuspend() {
        suspending = true;
        showError = false;
        client.suspendUser(userId, reason).then((success) => {
            if (success) {
                onClose();
            } else {
                showError = true;
            }
            suspending = false;
        });
    }
</script>

<Overlay dismissible {onClose}>
    <ModalContent {onClose}>
        {#snippet header()}
            <div><Translatable resourceKey={i18nKey("suspendedUser")} /></div>
        {/snippet}
        {#snippet body()}
            <div>
                <TextArea
                    bind:value={reason}
                    autofocus
                    minlength={3}
                    maxlength={512}
                    placeholder={i18nKey("reasonForSuspension")}>
                    {#if showError}
                        <ErrorMessage
                            ><Translatable
                                resourceKey={i18nKey("failedToSuspendUser")} /></ErrorMessage>
                    {/if}
                </TextArea>
            </div>
        {/snippet}
        {#snippet footer()}
            <div>
                <ButtonGroup>
                    <Button onClick={onSuspend} loading={suspending} small>
                        <Translatable resourceKey={i18nKey("suspend")} />
                    </Button>
                    <Button onClick={onClose} disabled={suspending} small secondary>
                        <Translatable resourceKey={i18nKey("cancel")} />
                    </Button>
                </ButtonGroup>
            </div>
        {/snippet}
    </ModalContent>
</Overlay>

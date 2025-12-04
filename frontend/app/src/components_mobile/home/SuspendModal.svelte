<script lang="ts">
    import { Button, Container, Sheet, Subtitle, TextArea } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Translatable from "../Translatable.svelte";

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

<Sheet onDismiss={onClose}>
    <Container gap={"xl"} padding={"xl"} direction={"vertical"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("suspendedUser")} />
        </Subtitle>

        <TextArea
            bind:value={reason}
            minlength={3}
            maxlength={512}
            placeholder={interpolate($_, i18nKey("reasonForSuspension"))}>
        </TextArea>

        {#if showError}
            <ErrorMessage
                ><Translatable resourceKey={i18nKey("failedToSuspendUser")} /></ErrorMessage>
        {/if}

        <Container gap={"md"} direction={"vertical"}>
            <Button onClick={onSuspend} loading={suspending}>
                <Translatable resourceKey={i18nKey("suspend")} />
            </Button>
            <Button onClick={onClose} disabled={suspending} secondary>
                <Translatable resourceKey={i18nKey("cancel")} />
            </Button>
        </Container>
    </Container>
</Sheet>

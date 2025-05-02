<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { app, notificationStatus } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    $inspect(`PUSH STATUS: ${$notificationStatus}`);
</script>

{#if !app.anonUser && $notificationStatus === "prompt"}
    <Overlay dismissible>
        <ModalContent>
            {#snippet header()}
                <Translatable resourceKey={i18nKey("Notifications")} />
            {/snippet}
            {#snippet body()}
                <Translatable resourceKey={i18nKey("enableNotifications")} />
            {/snippet}
            {#snippet footer()}
                <ButtonGroup>
                    <Button onClick={() => client.askForNotificationPermission()}
                        ><Translatable resourceKey={i18nKey("yesPlease")} /></Button>
                    <Button secondary onClick={() => client.setSoftDisabled(true)}
                        ><Translatable resourceKey={i18nKey("noThanks")} /></Button>
                </ButtonGroup>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

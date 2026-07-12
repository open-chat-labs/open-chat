<script lang="ts">
    import type { OpenChat } from "@client";
    import { anonUserStore, notificationStatus } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import Button from "@src/ui/Button.svelte";
    import ButtonGroup from "@src/ui/ButtonGroup.svelte";
    import ModalContent from "@src/ui/ModalContent.svelte";
    import Overlay from "@src/ui/Overlay.svelte";
    import Translatable from "@src/ui/Translatable.svelte";

    const client = getContext<OpenChat>("client");

    $inspect(`PUSH STATUS: ${$notificationStatus}`);
</script>

{#if !$anonUserStore && $notificationStatus === "prompt"}
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

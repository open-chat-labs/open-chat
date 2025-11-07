<script lang="ts">
    import { BodySmall, CommonButton, Container, Sheet, Title } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { anonUserStore, notificationStatus } from "openchat-client";
    import { getContext } from "svelte";
    import Bell from "svelte-material-icons/BellOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    $inspect(`PUSH STATUS: ${$notificationStatus}`);
</script>

{#if !$anonUserStore && $notificationStatus === "prompt"}
    <Sheet onDismiss={() => client.setSoftDisabled(true)}>
        <Container height={{ kind: "hug" }} padding={"xl"} gap={"xl"} direction={"vertical"}>
            <Container gap={"lg"} padding={"md"} direction={"vertical"}>
                <Title fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Notifications")} />
                </Title>

                <BodySmall colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("enableNotifications")} />
                </BodySmall>
            </Container>

            <Container gap={"md"} crossAxisAlignment={"end"} mainAxisAlignment={"end"}>
                <CommonButton onClick={() => client.setSoftDisabled(true)} size={"medium"}>
                    <Translatable resourceKey={i18nKey("noThanks")} />
                </CommonButton>
                <CommonButton
                    mode={"active"}
                    onClick={() => client.askForNotificationPermission()}
                    size={"medium"}>
                    {#snippet icon(color, size)}
                        <Bell {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("yesPlease")} />
                </CommonButton>
            </Container>
        </Container>
    </Sheet>
{/if}

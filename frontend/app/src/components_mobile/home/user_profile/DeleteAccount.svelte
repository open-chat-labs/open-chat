<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, BodySmall, Button, Container, H2 } from "component-lib";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import ConfirmDeleteAccount from "../profile/ConfirmDeleteAccount.svelte";
    import ProfileSubPage from "./ProfileSubPage.svelte";

    let deleting = $state(false);
    let authenticating = $state(false);

    function deleteAccount() {
        authenticating = true;
    }
</script>

{#if authenticating}
    <ConfirmDeleteAccount
        bind:authenticating
        bind:deleting
        onClose={() => (authenticating = false)} />
{/if}

<ProfileSubPage title={i18nKey("Delete account")}>
    <Container
        padding={"xxl"}
        gap={"lg"}
        height={{ kind: "fill" }}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container gap={"xl"} direction={"vertical"}>
            <Container gap={"lg"} direction={"vertical"}>
                <H2 width={{ kind: "fixed", size: "80%" }} fontWeight={"bold"} colour={"primary"}>
                    <Translatable resourceKey={i18nKey("Deleting your OpenChat account")}
                    ></Translatable>
                </H2>

                <BodySmall>
                    <Translatable
                        resourceKey={i18nKey(
                            "If you delete your account, you will lose access to your OpenChat wallet and will not be able to restore access. Please make sure that you transfer funds out before you proceed.",
                        )}>
                    </Translatable>
                </BodySmall>
            </Container>
            <Container gap={"lg"} direction={"vertical"}>
                <Body fontWeight={"bold"} colour={"primary"}>
                    <Translatable resourceKey={i18nKey("We're sad to see you go 😢")}
                    ></Translatable>
                </Body>

                <BodySmall fontWeight={"bold"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "You are 100% sure that you want to completely delete your OpenChat account, and  you understand that this cannot be undone?",
                        )}>
                    </Translatable>
                </BodySmall>

                <BodySmall colour={"error"} fontWeight={"bold"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "Press the button below to re-authenticate and delete your account.",
                        )}>
                    </Translatable>
                </BodySmall>
            </Container>
            <Button loading={deleting} onClick={deleteAccount}>
                {#snippet icon(color)}
                    <Delete {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Re-authenticate & delete")}></Translatable>
            </Button>
        </Container>
    </Container>
</ProfileSubPage>

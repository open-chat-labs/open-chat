<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { BodySmall, Container, H2, IconButton, Label } from "component-lib";
    import { OpenChat, type BotClientConfigData } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import Translatable from "../../Translatable.svelte";
    import ProfileSubPage from "./ProfileSubPage.svelte";

    const client = getContext<OpenChat>("client");
    let botConfigData = $state<BotClientConfigData>();

    onMount(() => {
        client
            .getBotConfig()
            .then((config) => (botConfigData = config))
            .catch((err) => {
                toastStore.showFailureToast(i18nKey("bots.config.failure"), err);
            });
    });

    function onCopy(txt: string) {
        navigator.clipboard.writeText(txt);
    }
</script>

{#snippet datum(title: string, value: string)}
    <Container crossAxisAlignment={"start"}>
        <Container gap={"sm"} direction={"vertical"}>
            <BodySmall colour={"primary"}>
                <Translatable resourceKey={i18nKey(title)}></Translatable>
            </BodySmall>
            <Label width={{ kind: "hug" }} align={"start"}>
                <code class="label">
                    {value}
                </code>
            </Label>
        </Container>

        <IconButton onclick={() => onCopy(value)} size={"sm"}>
            {#snippet icon(color)}
                <ContentCopy {color}></ContentCopy>
            {/snippet}
        </IconButton>
    </Container>
{/snippet}

<ProfileSubPage title={i18nKey("Bot configuration")}>
    <Container
        padding={"xxl"}
        gap={"lg"}
        height={{ kind: "fill" }}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container gap={"xl"} direction={"vertical"}>
            <Container gap={"lg"} direction={"vertical"}>
                <H2 width={{ kind: "fixed", size: "80%" }} fontWeight={"bold"} colour={"primary"}>
                    <Translatable resourceKey={i18nKey("Building a bot")}></Translatable>
                </H2>

                <BodySmall>
                    <Translatable
                        resourceKey={i18nKey(
                            "If you are creating an OpenChat bot you will need certain pieces of configuration data as described in the bot development documentation. Tap on the values below to copy the relevant config for this environment.",
                        )}>
                    </Translatable>
                </BodySmall>

                {#if botConfigData !== undefined}
                    {@render datum("IC host URL", botConfigData?.icHost)}
                    {@render datum(
                        "OpenStorage index canister",
                        botConfigData?.openStorageIndexCanister,
                    )}
                    {@render datum("OpenChat public key", botConfigData?.ocPublicKey)}
                {/if}
            </Container>
        </Container>
    </Container>
</ProfileSubPage>

<style lang="scss">
    .label {
        word-break: break-all;
    }
</style>

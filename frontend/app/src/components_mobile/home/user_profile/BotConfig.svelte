<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { BodySmall, Container, CopyCard, H2 } from "component-lib";
    import { OpenChat, type BotClientConfigData } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Translatable from "../../Translatable.svelte";
    import Markdown from "../Markdown.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

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

{#snippet datum(title: string, body: string)}
    <CopyCard {title} {body} />
    <!-- <Container crossAxisAlignment={"start"}>
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
    </Container> -->
{/snippet}

<SlidingPageContent title={i18nKey("Bot configuration")} subtitle={i18nKey("Advanced options")}>
    <Container
        padding={["xxl", "lg"]}
        gap={"lg"}
        height={{ kind: "fill" }}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container padding={["zero", "lg"]} gap={"xl"} direction={"vertical"}>
            <H2 width={{ kind: "fixed", size: "80%" }} fontWeight={"bold"} colour={"primary"}>
                <Translatable resourceKey={i18nKey("Building a bot")}></Translatable>
            </H2>

            <BodySmall>
                <Markdown
                    text={"If you are creating an OpenChat bot you will need certain pieces of configuration data as described in the [bot development documentation](https://github.com/open-chat-labs/open-chat-bots). Tap on the values below to copy the relevant config for this environment."} />
            </BodySmall>
        </Container>
        <Container gap={"lg"} direction={"vertical"}>
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
</SlidingPageContent>

<style lang="scss">
    .label {
        word-break: break-all;
    }
</style>

<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { BodySmall, Button, Container, H2 } from "component-lib";
    import { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import Sync from "svelte-material-icons/Sync.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    let busy = $state(false);

    function clearCache() {
        busy = true;
        client
            .clearCachedData()
            .then(() => window.location.reload())
            .finally(() => (busy = false));
    }
</script>

<SlidingPageContent title={i18nKey("Cache management")} subtitle={i18nKey("Advanced options")}>
    <Container
        padding={"xxl"}
        gap={"lg"}
        height={{ kind: "fill" }}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container gap={"xl"} direction={"vertical"}>
            <Container gap={"lg"} direction={"vertical"}>
                <H2 width={{ kind: "fixed", size: "80%" }} fontWeight={"bold"} colour={"primary"}>
                    <Translatable resourceKey={i18nKey("In case of emergency break glass")}
                    ></Translatable>
                </H2>

                <BodySmall>
                    <Translatable
                        resourceKey={i18nKey(
                            "Under some circumstances, the data that we cache on your device can become corrupted and cause problems. As a last resort we may ask you to clear that cached data. Please do continue to report any problems even if they are resolved by clearing cached data.",
                        )}>
                    </Translatable>
                </BodySmall>

                <Button loading={busy} onClick={clearCache}>
                    {#snippet icon(color)}
                        <Sync {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Clear cached data")}></Translatable>
                </Button>
            </Container>
        </Container>
    </Container>
</SlidingPageContent>

<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { BodySmall, CommonButton, Container, H2 } from "component-lib";
    import { publish } from "openchat-client";
    import AccountStar from "svelte-material-icons/AccountStarOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    function verify() {
        publish("verifyHumanity");
    }
</script>

<SlidingPageContent title={i18nKey("Verification")}>
    <Container
        padding={"xxl"}
        gap={"lg"}
        height={"fill"}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container gap={"xl"} direction={"vertical"}>
            <Container gap={"lg"} direction={"vertical"}>
                <H2 width={{ size: "70%" }} fontWeight={"bold"} colour={"primary"}>
                    <Translatable resourceKey={i18nKey("Verify unique personhood")}></Translatable>
                </H2>

                <BodySmall>
                    <Translatable resourceKey={i18nKey("human.verification.consentBody")}
                    ></Translatable>
                </BodySmall>
            </Container>

            <Container mainAxisAlignment={"end"} gap={"sm"} crossAxisAlignment={"end"}>
                <CommonButton onClick={() => publish("closeModalPage")} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("Cancel")}></Translatable>
                </CommonButton>
                <CommonButton onClick={verify} size={"small_text"} mode={"active"}>
                    {#snippet icon(color, size)}
                        <AccountStar {color} {size}></AccountStar>
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Verify")}></Translatable>
                </CommonButton>
            </Container>
        </Container>
    </Container>
</SlidingPageContent>

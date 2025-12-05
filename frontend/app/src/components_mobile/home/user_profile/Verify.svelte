<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import {
        Body,
        BodySmall,
        ColourVars,
        CommonButton,
        Container,
        H2,
        Subtitle,
        Switch,
    } from "component-lib";
    import { publish } from "openchat-client";
    import { _ } from "svelte-i18n";
    import AccountStar from "svelte-material-icons/AccountStarOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import Markdown from "../Markdown.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    let confirmed = $state(false);
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
                    <Translatable resourceKey={i18nKey("human.instruction")}></Translatable>
                </BodySmall>

                <Subtitle fontWeight={"bold"} colour={"primary"}>
                    <Translatable resourceKey={i18nKey("IMPORTANT! Before you proceed")}
                    ></Translatable>
                </Subtitle>

                <Body fontWeight={"bold"}>
                    <Markdown
                        text={interpolate($_, i18nKey("access.doYouHaveUniquePersonCredential"))} />
                </Body>

                <BodySmall>
                    <Markdown text={interpolate($_, i18nKey("access.uniquePersonInfo2"))} />
                </BodySmall>

                <BodySmall>
                    <Translatable resourceKey={i18nKey("access.uniquePersonInfo3")}></Translatable>
                </BodySmall>

                <Container
                    background={ColourVars.background1}
                    crossAxisAlignment={"center"}
                    borderRadius={"md"}
                    gap={"lg"}
                    padding={"lg"}>
                    <BodySmall>
                        <Translatable
                            resourceKey={i18nKey(
                                "I have verified my unique personhood with DecideAI",
                            )}>
                        </Translatable>
                    </BodySmall>
                    <Switch bind:checked={confirmed}></Switch>
                </Container>
            </Container>

            <Container mainAxisAlignment={"end"} gap={"sm"} crossAxisAlignment={"end"}>
                <CommonButton onClick={() => publish("closeModalPage")} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("Cancel")}></Translatable>
                </CommonButton>
                <CommonButton
                    disabled={!confirmed}
                    onClick={verify}
                    size={"medium"}
                    mode={"active"}>
                    {#snippet icon(color, size)}
                        <AccountStar {color} {size}></AccountStar>
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Verify")}></Translatable>
                </CommonButton>
            </Container>
        </Container>
    </Container>
</SlidingPageContent>

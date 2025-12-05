<script lang="ts">
    import { i18nKey, setLocale, supportedLanguages } from "@src/i18n/i18n";
    import { Body, BodySmall, Container } from "component-lib";
    import { locale } from "svelte-i18n";
    import Translatable from "../../Translatable.svelte";
    import LanguageSelector from "../LanguageSelector.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import FontSize from "./FontSize.svelte";

    let selectedLocale = $state(($locale as string).substring(0, 2));
    let selectedLanguage = $state(supportedLanguages.find((l) => l.code === selectedLocale));

    $effect(() => {
        setLocale(selectedLanguage?.code ?? "en");
    });
</script>

<SlidingPageContent title={i18nKey("Appearance")} subtitle={i18nKey("General options")}>
    <Container
        padding={["xxl", "lg"]}
        gap={"lg"}
        height={"fill"}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container gap={"xl"} direction={"vertical"}>
            <Container padding={["zero", "lg"]} direction={"vertical"}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Choose preferred language")}></Translatable>
                </Body>

                <BodySmall colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "Choose the language you would like to use as the default one for all the text shown within the app.",
                        )}></Translatable>
                </BodySmall>
            </Container>

            <LanguageSelector
                selected={selectedLanguage}
                onSelect={(lang) => (selectedLanguage = lang)}
                placeholder={"Choose your preferred language"}>
                {#snippet subtext()}
                    <Translatable
                        resourceKey={i18nKey("This does not apply to messages sent or received")}
                    ></Translatable>
                {/snippet}
            </LanguageSelector>
        </Container>

        <Container gap={"xl"} direction={"vertical"}>
            <Container padding={["zero", "lg"]} direction={"vertical"}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Adjust font size & spacing")}
                    ></Translatable>
                </Body>

                <BodySmall colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "Adjust the font size if you are having trouble reading and of the text within the app.",
                        )}></Translatable>
                </BodySmall>
            </Container>
            <Container padding={["zero", "lg"]} direction={"vertical"}>
                <FontSize />
            </Container>
        </Container>
    </Container>
</SlidingPageContent>

<script lang="ts">
    import { i18nKey, setLocale, supportedLanguages } from "@src/i18n/i18n";
    import { Body, BodySmall, Container, Option, Select } from "component-lib";
    import { locale } from "svelte-i18n";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import FontSize from "./FontSize.svelte";

    let selectedLocale = $state(($locale as string).substring(0, 2));
    let selectedLanguage = $state(supportedLanguages.find((l) => l.code === selectedLocale));

    $effect(() => {
        setLocale(selectedLanguage?.code ?? "en");
    });
</script>

<SlidingPageContent title={i18nKey("Appearance")}>
    <Container
        padding={["xxl", "lg"]}
        gap={"lg"}
        height={{ kind: "fill" }}
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

            <Select
                onSelect={(lang) => (selectedLanguage = lang)}
                placeholder={"Choose your preferred language"}
                value={selectedLanguage}>
                {#snippet selectedValue(val)}
                    {val.name}
                {/snippet}
                {#snippet selectOptions(onSelect)}
                    <Container padding={"lg"} direction={"vertical"}>
                        {#each supportedLanguages as lang}
                            <Option
                                value={lang}
                                onClick={onSelect}
                                selected={selectedLanguage?.code === lang.code}>
                                {lang.name}
                            </Option>
                        {/each}
                    </Container>
                {/snippet}
                {#snippet subtext()}
                    <Translatable
                        resourceKey={i18nKey("This does not apply to messages sent or received")}
                    ></Translatable>
                {/snippet}
            </Select>
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

<script lang="ts">
    import { i18nKey, setLocale, supportedLanguages } from "@src/i18n/i18n";
    import {
        setThemeV2Appearance,
        themeV2Appearance,
        themeV2Family,
    } from "@src/theme/themeV2";
    import { Body, BodySmall, Chip, Container, Row, type ThemeAppearance } from "component-lib";
    import { locale } from "svelte-i18n";
    import Translatable from "../../Translatable.svelte";
    import LanguageSelector from "../LanguageSelector.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import FontSize from "./FontSize.svelte";
    import ThemeSelector from "./ThemeSelector.svelte";

    const appearanceOptions: ThemeAppearance[] = ["system", "dark", "light"];
    const appearanceLabels: Record<ThemeAppearance, string> = {
        system: "System",
        dark: "Dark",
        light: "Light",
    };

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
                    <Translatable resourceKey={i18nKey("Choose theme")}></Translatable>
                </Body>

                <BodySmall colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "Switch between dark and light mode and choose the theme you would like to use within the app.",
                        )}></Translatable>
                </BodySmall>
            </Container>

            <Container padding={["zero", "lg"]} gap={"lg"} direction={"vertical"}>
                <Row mainAxisAlignment={"spaceBetween"} gap={"sm"}>
                    {#each appearanceOptions as appearance (appearance)}
                        {@const selected = $themeV2Appearance === appearance}
                        <Chip
                            width={selected ? { share: 1.3 } : { share: 1 }}
                            mode={selected ? "rounded" : "unselected"}
                            onClick={() => setThemeV2Appearance(appearance)}>
                            <Translatable resourceKey={i18nKey(appearanceLabels[appearance])}
                            ></Translatable>
                        </Chip>
                    {/each}
                </Row>

                <ThemeSelector selected={$themeV2Family} />
            </Container>
        </Container>

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

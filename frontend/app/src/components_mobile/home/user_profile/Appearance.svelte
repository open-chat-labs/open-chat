<script lang="ts">
    import { i18nKey, setLocale, supportedLanguages } from "@src/i18n/i18n";
    import { Body, BodySmall, ColourVars, Container, Select } from "component-lib";
    import { locale } from "svelte-i18n";
    import Translatable from "../../Translatable.svelte";
    import FontSize from "./FontSize.svelte";
    import ProfileSectionHeader from "./ProfileSectionHeader.svelte";

    let selectedLocale = $state(($locale as string).substring(0, 2));

    $effect(() => {
        setLocale(selectedLocale);
    });
</script>

<Container
    mainAxisAlignment={"spaceBetween"}
    background={ColourVars.background0}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <ProfileSectionHeader titleKey={i18nKey("Appearance")} />
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

            <Select bind:value={selectedLocale}>
                {#each supportedLanguages as lang}
                    <option value={lang.code}>{lang.name}</option>
                {/each}
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
</Container>

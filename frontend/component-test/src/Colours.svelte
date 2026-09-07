<script lang="ts">
    import { Container, H2, Pixel, Subtitle, theme as neon, type Colours } from "component-lib";

    type Section = {
        name: string;
        colours: ColourCard[];
    };

    type ColourCard = {
        name: string;
        key: keyof Colours;
    };

    const mainColours: ColourCard[] = [
        { name: "Primary", key: "primary" },
        { name: "Secondary", key: "secondary" },
        { name: "Tertiary", key: "tertiary" },
    ];

    const modifiedColours: ColourCard[] = [
        { name: "Primary Accent", key: "primaryAccent" },
        { name: "Secondary Accent", key: "secondaryAccent" },
        { name: "Tertiary Accent", key: "tertiaryAccent" },
        { name: "Primary Surface", key: "primarySurface" },
        { name: "Secondary Surface", key: "secondarySurface" },
        { name: "Tertiary Surface", key: "tertiarySurface" },
    ];

    const feedbackColours: ColourCard[] = [
        { name: "Validation Success", key: "validationSuccess" },
        { name: "Validation Warning", key: "validationWarning" },
        { name: "Validation Error", key: "validationError" },
        { name: "Success Surface", key: "successSurface" },
        { name: "Warning Surface", key: "warningSurface" },
        { name: "Error Surface", key: "errorSurface" },
        { name: "On Feedback Surface", key: "textOnFeedbackSurface" },
    ];

    const typographyColours: ColourCard[] = [
        { name: "Primary", key: "textPrimary" },
        { name: "Secondary", key: "textSecondary" },
        { name: "On Primary", key: "textOnPrimary" },
        { name: "On Disabled Surface", key: "textOnDisabledSurface" },
        { name: "Input Placeholder", key: "inputPlaceholder" },
    ];

    const backgroundColours: ColourCard[] = [
        { name: "Surface 0", key: "surface0" },
        { name: "Surface 1", key: "surface1" },
        { name: "Surface 2", key: "surface2" },
        { name: "Surface Disabled", key: "surfaceDisabled" },
        { name: "Input Background", key: "inputBackground" },
        { name: "Main Nav Background", key: "mainNavBackground" },
    ];

    const allColours: Section[] = [
        {
            name: "Main",
            colours: mainColours,
        },
        { name: "Modified", colours: modifiedColours },
        { name: "Feedback", colours: feedbackColours },
        { name: "Backgrounds", colours: backgroundColours },
        { name: "Typography", colours: typographyColours },
    ];
</script>

{#snippet card(name: string, code: string, summary: string = code)}
    <Container minWidth={new Pixel(150)} gap={"md"} direction={"vertical"}>
        <div class="name">{name}</div>
        <div class="circle" style={`background: ${code};`}></div>
        <div class="code">{summary}</div>
    </Container>
{/snippet}

<Container gap={"md"} direction={"vertical"}>
    <H2>Colours / <span class="neon">Neon</span> theme</H2>
    <Container gap={"lg"} direction={"vertical"}>
        {#each allColours as { name, colours }}
            <Container
                borderRadius={"lg"}
                width={"hug"}
                padding={"lg"}
                borderWidth={"thin"}
                direction={"vertical"}>
                <Subtitle fontWeight={"bold"}>{name}</Subtitle>
                <Container gap={"xs"} padding={["lg", "zero", "xxl", "zero"]}>
                    {#each colours as { name, key }}
                        {@const colour = neon.colours[key]}
                        {@const code = colour.toString()}
                        {@render card(name, code)}
                    {/each}
                </Container>
            </Container>
        {/each}
        <Container
            width={"hug"}
            borderRadius={"lg"}
            padding={"lg"}
            borderWidth={"thin"}
            direction={"vertical"}>
            <Subtitle fontWeight={"semi-bold"}>{"Gradients"}</Subtitle>
            <Container gap={"xl"} padding={["lg", "zero", "xxl", "zero"]}>
                {@render card(
                    "Primary Gradient",
                    neon.colours.gradient.toString(),
                    neon.colours.gradient.summarise(),
                )}
                {@render card(
                    "Primary Gradient Inverted",
                    neon.colours.gradientInverted.toString(),
                    neon.colours.gradientInverted.summarise(),
                )}
            </Container>
        </Container>
    </Container>
</Container>

<style lang="scss">
    .neon {
        color: var(--primary);
    }

    .name {
        color: var(--text-secondary);
        align-self: center;
        white-space: nowrap;
    }

    .code {
        text-transform: uppercase;
        align-self: center;
    }

    .circle {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        align-self: center;
    }
</style>

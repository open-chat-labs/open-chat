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
        { name: "Success", key: "success" },
        { name: "Warning", key: "warning" },
        { name: "Error", key: "error" },
    ];

    const modifiedColours: ColourCard[] = [
        { name: "Primary Muted", key: "primaryMuted" },
        { name: "Secondary Muted", key: "secondaryMuted" },
        { name: "Tertiary Muted", key: "tertiaryMuted" },
        { name: "Primary Light", key: "primaryLight" },
        { name: "Secondary Light", key: "secondaryLight" },
        { name: "Tertiary Light", key: "tertiaryLight" },
    ];

    const typographyColours: ColourCard[] = [
        { name: "Primary", key: "textPrimary" },
        { name: "Secondary", key: "textSecondary" },
        { name: "Tertiary", key: "textTertiary" },
        { name: "Placeholder", key: "textPlaceholder" },
        { name: "On Primary", key: "textOnPrimary" },
    ];

    const backgroundColours: ColourCard[] = [
        { name: "Level 0", key: "background0" },
        { name: "Level 1", key: "background1" },
        { name: "Level 2", key: "background2" },
        { name: "Disabled Button", key: "disabledButton" },
    ];

    const allColours: Section[] = [
        {
            name: "Main",
            colours: mainColours,
        },
        { name: "Modified", colours: modifiedColours },
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

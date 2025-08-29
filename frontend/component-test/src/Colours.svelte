<script lang="ts">
    import { Container, theme as neon, type Colours } from "component-lib";

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
        { name: "Success", key: "success" },
        { name: "Warning", key: "warning" },
        { name: "Error", key: "error" },
    ];

    const mutedColours: ColourCard[] = [
        { name: "Primary Muted", key: "primaryMuted" },
        { name: "Primary Light", key: "primaryLight" },
        { name: "Secondary Muted", key: "secondaryMuted" },
        { name: "Warning Muted", key: "warningMuted" },
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
        { name: "Backgrounds", colours: backgroundColours },
        { name: "Muted", colours: mutedColours },
        { name: "Typography", colours: typographyColours },
    ];
</script>

{#snippet card(name: string, code: string, summary: string = code)}
    <Container gap={"md"} direction={"vertical"}>
        <div class="name">{name}</div>
        <div class="circle" style={`background: ${code};`}></div>
        <div class="code">{summary}</div>
    </Container>
{/snippet}

<Container direction={"vertical"}>
    <h3>Colours / <span class="neon">Neon</span> theme</h3>
    <Container gap={"lg"} direction={"vertical"}>
        {#each allColours as { name, colours }}
            <Container
                borderRadius={"lg"}
                padding={["lg"]}
                borderWidth={"thin"}
                direction={"vertical"}>
                <h3>{name}</h3>
                <Container gap={"xl"} padding={["lg", "zero", "xxl", "zero"]}>
                    {#each colours as { name, key }}
                        {@const colour = neon.colours[key]}
                        {@const code = colour.toString()}
                        {@render card(name, code)}
                    {/each}
                </Container>
            </Container>
        {/each}
        <Container borderRadius={"lg"} padding={["lg"]} borderWidth={"thin"} direction={"vertical"}>
            <h3>{"Gradients"}</h3>
            <Container gap={"xl"} padding={["lg", "zero", "xxl", "zero"]}>
                {@render card(
                    "Primary Gradient",
                    neon.colours.primaryGradient.toString(),
                    neon.colours.primaryGradient.summarise(),
                )}
                {@render card(
                    "Primary Gradient Inverted",
                    neon.colours.primaryGradientInverted.toString(),
                    neon.colours.primaryGradientInverted.summarise(),
                )}
            </Container>
        </Container>
    </Container>
</Container>

<style lang="scss">
    .grid {
        padding: var(--sp-md);
    }

    .neon {
        color: var(--primary);
    }

    .name {
        color: var(--text-secondary);
        align-self: center;
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

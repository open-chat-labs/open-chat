<script lang="ts">
    import type { Colours } from "component-lib";
    import { theme as neon } from "component-lib";

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
        { name: "Muted", colours: mutedColours },
        { name: "Typography", colours: typographyColours },
        { name: "Backgrounds", colours: backgroundColours },
    ];
</script>

<h3>Colours / <span class="neon">Neon</span> theme</h3>
<div class="grid">
    {#each allColours as { name, colours }}
        <h3>{name}</h3>
        <div class="section">
            {#each colours as { name, key }}
                {@const colour = neon.colours[key]}
                {@const code = colour.toString()}
                <div class={`${key} card`}>
                    <div class="name">{name}</div>
                    <div class="circle" style={`background: ${code};`}></div>
                    <div class="code">{code}</div>
                </div>
            {/each}
        </div>
    {/each}

    <h3>{"Gradients"}</h3>
    <div class="section">
        <div class={`card`}>
            <div class="name">{"Primary Gradient"}</div>
            <div class="circle" style={`background: ${neon.colours.primaryGradient.toString()};`}>
            </div>
            <div class="code">{neon.colours.primaryGradient.summarise()}</div>
        </div>
        <div class={`card`}>
            <div class="name">{"Primary Gradient Inverted"}</div>
            <div
                class="circle"
                style={`background: ${neon.colours.primaryGradientInverted.toString()};`}>
            </div>
            <div class="code">{neon.colours.primaryGradientInverted.summarise()}</div>
        </div>
    </div>
</div>

<style lang="scss">
    .grid {
        padding: var(--sp-md);
    }

    .neon {
        color: var(--primary);
    }

    .section {
        display: flex;
        gap: var(--sp-xxl);
        margin-bottom: var(--sp-xxxl);
    }

    .card {
        display: flex;
        flex-direction: column;
        gap: var(--sp-md);
        min-width: 100px;
        align-items: center;
        justify-content: center;

        .name {
            color: var(--text-secondary);
        }

        .code {
            text-transform: uppercase;
        }

        .circle {
            width: 80px;
            height: 80px;
            border-radius: 50%;
        }
    }
</style>

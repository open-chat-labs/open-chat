<script lang="ts">
    import type { Colours } from "../src/theme/colour";
    import { theme as neon } from "../src/theme/neon";

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
        { name: "Primary Muted", key: "primaryMuted" },
    ];

    const gradients: ColourCard[] = [
        { name: "Primary", key: "primaryGradient" },
        { name: "Inverted", key: "primaryGradientInverted" },
    ];

    const allColours: ColourCard[][] = [
        mainColours,
        typographyColours,
        backgroundColours,
        gradients,
    ];
</script>

<h3>Colours / <span class="neon">Neon</span> theme</h3>
<div class="grid">
    {#each allColours as colours}
        <div class="section">
            {#each colours as { name, key }}
                {@const code = neon.colours[key].toString()}
                <div class={`${key} card`}>
                    <div class="name">{name}</div>
                    <div class="circle" style={`background: ${code};`}></div>
                    <div class="code">{code}</div>
                </div>
            {/each}
        </div>
    {/each}
</div>

<style lang="scss">
    .grid {
        padding: 10px;
    }

    .neon {
        color: var(--primary);
    }

    .section {
        display: flex;
        gap: 30px;
        margin-bottom: 50px;
    }

    .card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 100px;
        align-items: center;
        justify-content: center;

        .name {
            color: var(--textSecondary);
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

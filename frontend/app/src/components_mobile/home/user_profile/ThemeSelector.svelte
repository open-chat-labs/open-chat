<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { getThemeV2Families, setPreferredThemeV2 } from "@src/theme/themeV2";
    import {
        builtinThemes,
        Body,
        Column,
        ColourVars,
        Row,
        Select,
        Subtitle,
        type ThemeColourArgs,
    } from "component-lib";
    import type { Snippet } from "svelte";
    import Translatable from "../../Translatable.svelte";

    const PREVIEW_KEYS: ThemeColourArgs[] = ["primary", "secondary", "surface0", "surface1"];

    interface Props {
        selected?: string;
        subtext?: Snippet;
    }

    let { selected, subtext }: Props = $props();
    let familyNames = getThemeV2Families();
</script>

<Select
    {subtext}
    onSelect={setPreferredThemeV2}
    placeholder={"Theme presets"}
    value={selected}>
    {#snippet selectedValue(val)}
        <span class="selected_theme">{val}</span>
    {/snippet}
    {#snippet selectOptions(onSelect)}
        <Column
            gap={"lg"}
            padding={["lg", "zero"]}
            height={{ size: "100%" }}
            supplementalClass={"theme_options"}
            onClick={(e) => e?.stopPropagation()}>
            <Row padding={["zero", "lg"]}>
                <Subtitle fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Theme presets")}></Translatable>
                </Subtitle>
            </Row>

            <Column supplementalClass={"binding_options"}>
                {#each familyNames as id (id)}
                    {@const active = selected === id}
                    <Row
                        backgroundColor={active ? ColourVars.surface2 : undefined}
                        crossAxisAlignment={"center"}
                        gap={"lg"}
                        onClick={() => onSelect(id)}
                        padding={"sm"}>
                        <Row
                            crossAxisAlignment={"center"}
                            padding={["lg", "lg"]}
                            gap={"xxs"}
                            width={"hug"}>
                            {#each PREVIEW_KEYS as key (key)}
                                <div
                                    class="swatch"
                                    style:background-color={builtinThemes[id].colours[key]}>
                                </div>
                            {/each}
                        </Row>
                        <Body
                            colour={active ? "textPrimary" : "textSecondary"}
                            fontWeight={active ? "bold" : "normal"}>
                            <span class="selected_theme">{id}</span>
                        </Body>
                    </Row>
                {/each}
            </Column>
        </Column>
    {/snippet}
</Select>

<style lang="scss">
    :global(.container.theme_options) {
        flex: auto !important;
    }

    .swatch {
        width: 1.25rem;
        height: 1.25rem;
        border-radius: var(--rad-circle);
        border: 1px solid rgba(255, 255, 255, 0.15);
    }

    .selected_theme {
        text-transform: capitalize;
    }
</style>

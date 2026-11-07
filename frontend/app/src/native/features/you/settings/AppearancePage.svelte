<!-- You → Appearance (native design notes §3.11): Mode (Light, Dark, System), the accent, and the
     text size. The same stored settings as Welcome's Appearance menu and the web's profile
     (themeType, accentStore, fontScaleStore), so each shows what the others picked; System follows
     the phone's light and dark live. The text size scales every size in the app (--text-scale),
     on top of the phone's own text size (GAPS.md: the design's "Chat text size"). -->
<script lang="ts">
    import { fontScaleStore } from "@client";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsSegmented from "@openchat/ui/src/native/SettingsSegmented.svelte";
    import SettingsSwatches from "@openchat/ui/src/native/SettingsSwatches.svelte";
    import { PAGE_ACCENTS } from "@openchat/ui/src/pages/types";
    import {
        FONT_SIZES,
        fontScaleFor,
        fontSizeOf,
        THEME_PREFS,
        themePrefOf,
    } from "@src/logic/profile/appearance";
    import { accentStore } from "@theme/accent";
    import { themeType } from "@theme/themes";
    import { _ } from "svelte-i18n";

    const modes = $derived(THEME_PREFS.map((mode) => $_(`native.start.appearance.${mode}`)));
    const mode = $derived(THEME_PREFS.indexOf(themePrefOf($themeType)));

    const swatches = $derived(
        PAGE_ACCENTS.map((accent) => ({
            id: accent,
            label: $_(`native.start.appearance.accents.${accent}`),
            colour: `var(--swatch-${accent})`,
        })),
    );

    const sizes = $derived(FONT_SIZES.map((size) => $_(`native.you.appearance.sizes.${size}`)));
    const size = $derived(FONT_SIZES.indexOf(fontSizeOf($fontScaleStore)));
</script>

<SettingsGroup label={$_("native.start.appearance.theme")}>
    <SettingsSegmented
        label={$_("native.you.appearance.mode")}
        options={modes}
        selected={mode}
        onSelect={(i) => themeType.set(THEME_PREFS[i])} />
    <SettingsSwatches
        label={$_("native.start.appearance.accent")}
        {swatches}
        selected={$accentStore}
        onSelect={(id) => accentStore.set(PAGE_ACCENTS.find((a) => a === id) ?? $accentStore)} />
</SettingsGroup>

<SettingsGroup label={$_("native.you.appearance.text")} note={$_("native.you.appearance.textNote")}>
    <SettingsSegmented
        label={$_("native.you.appearance.textSize")}
        options={sizes}
        selected={size}
        onSelect={(i) => fontScaleStore.set(fontScaleFor(FONT_SIZES[i], $fontScaleStore))} />
</SettingsGroup>

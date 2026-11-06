<!-- Welcome's Appearance (native design notes §3.1): the theme (Light, Dark, System) and the accent,
     both live, from the same stored settings the app and the web use. The design has them in an
     anchored menu; here they're a sheet of the kit's settings rows, as the You tab's Appearance will
     be (GAPS.md). -->
<script lang="ts">
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsSegmented from "@openchat/ui/src/native/SettingsSegmented.svelte";
    import SettingsSwatches from "@openchat/ui/src/native/SettingsSwatches.svelte";
    import { PAGE_ACCENTS } from "@openchat/ui/src/pages/types";
    import { accentStore } from "@theme/accent";
    import { themeType } from "@theme/themes";
    import { _ } from "svelte-i18n";

    type Props = { open: boolean; onClose: () => void };

    let { open, onClose }: Props = $props();

    const MODES = ["light", "dark", "system"] as const;

    const modes = $derived(MODES.map((mode) => $_(`native.start.appearance.${mode}`)));
    const selectedMode = $derived(Math.max(0, MODES.findIndex((mode) => mode === $themeType)));
    const swatches = $derived(
        PAGE_ACCENTS.map((accent) => ({
            id: accent,
            label: $_(`native.start.appearance.accents.${accent}`),
            colour: `var(--swatch-${accent})`,
        })),
    );

    function pickAccent(id: string) {
        const accent = PAGE_ACCENTS.find((a) => a === id);
        if (accent !== undefined) accentStore.set(accent);
    }
</script>

<BottomSheet {open} {onClose} title={$_("native.start.appearance.title")}>
    <div class="body">
        <SettingsGroup>
            <SettingsSegmented
                label={$_("native.start.appearance.theme")}
                options={modes}
                selected={selectedMode}
                onSelect={(i) => themeType.set(MODES[i])} />
            <SettingsSwatches
                label={$_("native.start.appearance.accent")}
                {swatches}
                selected={$accentStore}
                onSelect={pickAccent} />
        </SettingsGroup>
    </div>
</BottomSheet>

<style lang="scss">
    .body {
        padding: var(--space-4) var(--space-16) var(--scroll-end);
    }
</style>

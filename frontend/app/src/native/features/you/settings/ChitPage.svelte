<!-- CHIT's settings (native design notes §3.10, You → CHIT, the web's ?profile=chit): CHIT on or
     off, and with it on, achievement alerts and hiding the CHIT button once today's claim is made;
     with it off, what that means. The same settings as the web's profile and the old UIs keep, in
     this browser (disableChit, chitPopup, hideChitIcon). The design's daily puzzle choice (Hidden /
     Show / Show + remind) isn't a setting the app has yet (GAPS.md). -->
<script lang="ts">
    import { chitStateStore } from "@client";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsSwitch from "@openchat/ui/src/native/SettingsSwitch.svelte";
    import { chitPopup, disableChit, hideChitIcon } from "@src/stores/settings";
    import { _, locale } from "svelte-i18n";

    // kept while CHIT is off, for when it's back on
    const balance = $derived($chitStateStore.chitBalance.toLocaleString($locale ?? "en"));
</script>

<SettingsGroup>
    <SettingsSwitch
        label="CHIT"
        help={$_("native.you.chit.enableHelp")}
        on={!$disableChit}
        onChange={(on) => disableChit.set(!on)} />
</SettingsGroup>

{#if $disableChit}
    <p class="off">
        {$_("native.you.chit.off", { values: { amount: balance } })}
    </p>
{:else}
    <SettingsGroup label={$_("native.you.notifications.title")}>
        <SettingsSwitch
            label={$_("native.you.chit.notify")}
            help={$_("native.you.chit.notifyHelp")}
            on={$chitPopup}
            onChange={(on) => chitPopup.set(on)} />
        <SettingsSwitch
            label={$_("native.you.chit.hideButton")}
            help={$_("native.you.chit.hideButtonHelp")}
            on={$hideChitIcon}
            onChange={(on) => hideChitIcon.set(on)} />
    </SettingsGroup>
{/if}

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .off {
        margin: 0;
        padding: 0 4px;
        font: var(--weight-regular) text-size(14px) / 1.55 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }
</style>

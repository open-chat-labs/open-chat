<script lang="ts">
    import { isAndroidTauriApp } from "@shared";
    import {
        openFullScreenIntentSettings,
        shouldAskForFullScreenIntent,
    } from "@utils/native/fullScreenIntent";
    import { onMount } from "svelte";
    import { i18nKey } from "../i18n/i18n";
    import AreYouSure from "./AreYouSure.svelte";

    let show = $state(false);

    onMount(async () => {
        show = await shouldAskForFullScreenIntent(isAndroidTauriApp());
    });

    async function action(yes: boolean): Promise<void> {
        show = false;
        if (yes) await openFullScreenIntentSettings();
    }
</script>

{#if show}
    <AreYouSure
        title={i18nKey("fullScreenCalls.title")}
        message={i18nKey("fullScreenCalls.message")}
        yesLabel={i18nKey("fullScreenCalls.openSettings")}
        noLabel={i18nKey("fullScreenCalls.notNow")}
        {action}
        dismiss={() => (show = false)} />
{/if}

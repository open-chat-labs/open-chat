<script lang="ts">
    // Tells users on a pre-rename install that their app is a dead end.
    //
    // Builds before the com.oc.app -> com.oclabs.openchat rename are, to
    // Android, unrelated software: no APK will ever update them again. They
    // stay usable because OC_OTA_UPDATES=major is compiled into them, so they
    // keep taking web bundles - which is the only reason this notice can reach
    // them at all - but the first major website bump pulls them into a bundle
    // that needs a shell they can never install, and there is no way back.
    //
    // Nothing on those devices can be changed from here. This is a message
    // riding the one channel still open to them.
    import { isAndroidTauriApp } from "@shared";
    import { BodySmall, Button, Column, Overview, Sheet } from "component-lib";
    import { onMount } from "svelte";
    import { getShellVersion, openUrl } from "tauri-plugin-oc-api";
    import { i18nKey } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";

    const DOWNLOAD_URL = "https://github.com/open-chat-labs/open-chat/releases/latest";
    const DISMISSED_KEY = "oc_legacy_install_dismissed_at";
    // Asked again rather than asked once: losing the app is severe enough to
    // keep raising, and a permanent dismissal would let someone forget until
    // the release that strands them. A week is often enough to be heard and
    // rare enough not to become wallpaper.
    const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

    let show = $state(false);

    onMount(() => {
        if (!isAndroidTauriApp() || dismissedRecently()) return;
        isLegacyInstall().then((legacy) => (show = legacy));
    });

    // get_shell_version was added alongside the rename, so a shell old enough
    // to be orphaned does not have the command registered and invoke rejects.
    // A newer shell resolves, with the version or with undefined when the
    // version asset is unreadable - either way it is not orphaned.
    //
    // This infers the package name from a missing command because no command
    // on the old shell can report it directly. A rejection cannot happen on a
    // shell new enough to have the command, but this would misfire if some
    // future change made invoke fail for unrelated reasons.
    async function isLegacyInstall(): Promise<boolean> {
        try {
            await getShellVersion();
            return false;
        } catch {
            return true;
        }
    }

    function dismissedRecently(): boolean {
        try {
            const at = localStorage.getItem(DISMISSED_KEY);
            if (at === null) return false;
            return Date.now() - Number(at) < REMIND_AFTER_MS;
        } catch {
            return false;
        }
    }

    function dismiss() {
        show = false;
        try {
            localStorage.setItem(DISMISSED_KEY, String(Date.now()));
        } catch {
            // Storage unavailable just means it is asked again next launch.
        }
    }
</script>

{#if show}
    <Sheet onDismiss={dismiss}>
        <Column gap={"xl"} padding={"xxl"}>
            <Overview colour={"primary"}>
                <Translatable resourceKey={i18nKey("nativeUpdate.reinstallTitle")} />
            </Overview>
            <BodySmall width={"hug"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("nativeUpdate.reinstallMessage")} />
            </BodySmall>
            <BodySmall width={"hug"}>
                <Translatable resourceKey={i18nKey("nativeUpdate.reinstallUninstallOld")} />
            </BodySmall>

            <Button onClick={() => openUrl({ url: DOWNLOAD_URL })} secondary>
                <Translatable resourceKey={i18nKey("nativeUpdate.reinstallDownload")} />
            </Button>
        </Column>
    </Sheet>
{/if}

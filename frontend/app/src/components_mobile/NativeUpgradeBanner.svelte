<script lang="ts">
    import type { Version } from "@client";
    import { isAndroidTauriApp } from "@shared";
    import {
        fetchRelease,
        getStoreOffer,
        releasePath,
        shellUpdateFrom,
        storeOfferReaches,
    } from "@src/utils/shellUpdate";
    import { VersionChecker } from "@src/utils/version.svelte";
    import { appStoreBuild } from "@utils/features";
    import { BodySmall, Button, ColourVars, Column, Overview, Sheet } from "component-lib";
    import { onDestroy, onMount } from "svelte";
    import { getShellVersion, openUrl } from "tauri-plugin-oc-api";
    import { i18nKey } from "../i18n/i18n";
    import Progress from "./Progress.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.oclabs.openchat";
    const DIRECT_DOWNLOAD_URL = "https://github.com/open-chat-labs/open-chat/releases/latest";

    const checker = new VersionChecker();

    // Persisted, and keyed by version rather than a boolean.
    //
    // Persisted because review and staged rollout take days, and component
    // state would put the sheet back on every cold start for the whole of it.
    // Keyed by version because the poller keeps running, so a release can be
    // rolled back and a different one announced later; that one should be
    // shown rather than swallowed by the earlier dismissal.
    const DISMISSED_KEY = "oc_dismissed_update_version";

    let dismissedVersion = $state<string | undefined>(readDismissed());

    function readDismissed(): string | undefined {
        try {
            return localStorage.getItem(DISMISSED_KEY) ?? undefined;
        } catch {
            return undefined;
        }
    }

    function dismiss(version: string) {
        dismissedVersion = version;
        try {
            localStorage.setItem(DISMISSED_KEY, version);
        } catch {
            // Storage unavailable just means it reappears next launch.
        }
    }

    onDestroy(() => checker.stop());

    // What Play offers this store build, asked once per launch.
    let storeOffer = $state<Version | undefined>(undefined);

    // A release with different native code from the installed shell. The
    // bundle check cannot see this: a shell-only release leaves the website
    // version inside the OTA strategy, so the bundle updates silently and
    // nothing says a new APK exists.
    let newerShell = $state<string | undefined>(undefined);

    onMount(async () => {
        if (!isAndroidTauriApp()) return;
        if (appStoreBuild) storeOffer = await getStoreOffer();
        const path = releasePath(appStoreBuild, storeOffer);
        if (path === undefined) return;
        // A pre-rename shell has no get_shell_version and rejects;
        // LegacyInstallBanner owns that case.
        const shellVersion = await getShellVersion().catch(() => undefined);
        newerShell = shellUpdateFrom(shellVersion, await fetchRelease(path))?.toText();
    });

    // One dismissible sheet for both reasons a newer version may be waiting.
    // The shell notice waits for the bundle check to settle, so it never
    // appears and is then replaced by the blocking or downloading sheet.
    let available = $derived.by(() => {
        switch (checker.versionState.kind) {
            case "store_update_available":
                // Only once Play offers a build that gets there: before that
                // the store listing has nothing to install.
                return storeOfferReaches(storeOffer, checker.versionState.available)
                    ? checker.versionState.available.toText()
                    : newerShell;
            case "up_to_date":
            case "failed_update":
                return newerShell;
            default:
                return undefined;
        }
    });

    // A store build can only be updated through the store it came from; a
    // sideloaded build has to fetch a new APK itself.
    let upgradeUrl = $derived(appStoreBuild ? PLAY_STORE_URL : DIRECT_DOWNLOAD_URL);
    let upgradeLabel = $derived(
        appStoreBuild ? "nativeUpdate.fromPlayStore" : "nativeUpdate.downloadLatest",
    );
</script>

<!--
    A major bump: this shell cannot run the new bundle, so there is nothing to
    dismiss to. Safe to block only because the release-train runbook requires
    the store update to be live and rolled out BEFORE the website announces a
    major, so the button always leads somewhere.
-->
{#if checker.versionState.kind === "incompatible"}
    <Sheet>
        <Column gap={"xl"} padding={"xxl"}>
            <Overview colour={"primary"}>
                <Translatable resourceKey={i18nKey("nativeUpdate.requiredTitle")} />
            </Overview>
            <BodySmall width={"hug"} fontWeight={"bold"}>
                <Translatable
                    resourceKey={i18nKey("nativeUpdate.requiredMessage", {
                        version: checker.versionState.available.toText(),
                    })} />
            </BodySmall>

            <Button onClick={() => openUrl({ url: upgradeUrl })} secondary>
                <Translatable resourceKey={i18nKey(upgradeLabel)} />
            </Button>
        </Column>
    </Sheet>
{/if}

<!--
    A minor bump that Play now offers to this store build, or a release with
    native changes this shell lacks. The app works perfectly well on what it
    has, so this is dismissible. Passing onDismiss is what makes SheetWrapper
    honour the drag handle, backdrop and Escape.
-->
{#if available !== undefined && available !== dismissedVersion}
    {@const version = available}
    <Sheet onDismiss={() => dismiss(version)}>
        <Column gap={"xl"} padding={"xxl"}>
            <Overview colour={"primary"}>
                <Translatable resourceKey={i18nKey("nativeUpdate.availableTitle")} />
            </Overview>
            <BodySmall width={"hug"} fontWeight={"bold"}>
                <Translatable
                    resourceKey={i18nKey("nativeUpdate.availableMessage", {
                        version,
                    })} />
            </BodySmall>

            <Button onClick={() => openUrl({ url: upgradeUrl })} secondary>
                <Translatable resourceKey={i18nKey(upgradeLabel)} />
            </Button>
        </Column>
    </Sheet>
{/if}

{#if checker.versionState.kind === "out_of_date"}
    <Sheet>
        <Column gap={"xl"} padding={"xxl"}>
            <Overview colour={"primary"}>
                <Translatable resourceKey={i18nKey("nativeUpdate.downloadingTitle")} />
            </Overview>
            <BodySmall width={"hug"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("nativeUpdate.downloadingMessage")} />
            </BodySmall>

            <Progress
                colour={ColourVars.primary}
                size={"1rem"}
                percent={checker.versionState.downloadProgress} />

            <Button
                disabled={checker.versionState.downloadProgress < 100}
                onClick={() => checker.reload()}
                secondary>
                <Translatable resourceKey={i18nKey("nativeUpdate.reload")} />
            </Button>
        </Column>
    </Sheet>
{/if}

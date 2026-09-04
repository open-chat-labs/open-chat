<script lang="ts">
    import { VersionChecker } from "@src/utils/version.svelte";
    import { appStoreBuild } from "@utils/features";
    import { BodySmall, Button, ColourVars, Column, Overview, Sheet } from "component-lib";
    import { onDestroy } from "svelte";
    import { openUrl } from "tauri-plugin-oc-api";
    import { i18nKey } from "../i18n/i18n";
    import Progress from "./Progress.svelte";
    import Translatable from "./Translatable.svelte";

    const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.oclabs.openchat";
    const DIRECT_DOWNLOAD_URL = "https://github.com/open-chat-labs/open-chat/releases/latest";

    let checker = new VersionChecker();

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

    // A store build can only be updated through the store it came from; a
    // sideloaded build has to fetch a new APK itself.
    let upgradeUrl = $derived(appStoreBuild ? PLAY_STORE_URL : DIRECT_DOWNLOAD_URL);
    let upgradeLabel = $derived(
        appStoreBuild ? "Update from the Play Store" : "Download the latest version",
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
            <Overview colour={"primary"}>Update required</Overview>
            <BodySmall width={"hug"} fontWeight={"bold"}>
                <Translatable
                    resourceKey={i18nKey(
                        `Version ${checker.versionState.available.toText()} is available, but it needs a newer version of the app than the one you have installed. This one cannot update itself the rest of the way.`,
                    )} />
            </BodySmall>

            <Button onClick={() => openUrl({ url: upgradeUrl })} secondary>
                <Translatable resourceKey={i18nKey(upgradeLabel)} />
            </Button>
        </Column>
    </Sheet>
{/if}

<!--
    A minor bump on a store build. The app works perfectly well on what it has;
    the new version is simply waiting on review, and the store listing may show
    nothing at all for days. Passing onDismiss is what makes SheetWrapper honour
    the drag handle, backdrop and Escape.
-->
{#if checker.versionState.kind === "store_update_available" && checker.versionState.available.toText() !== dismissedVersion}
    {@const available = checker.versionState.available.toText()}
    <Sheet onDismiss={() => dismiss(available)}>
        <Column gap={"xl"} padding={"xxl"}>
            <Overview colour={"primary"}>Update available</Overview>
            <BodySmall width={"hug"} fontWeight={"bold"}>
                <Translatable
                    resourceKey={i18nKey(
                        `Version ${checker.versionState.available.toText()} is available. This one keeps working in the meantime.`,
                    )} />
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
            <Overview colour={"primary"}>One second! Updating ...</Overview>
            <BodySmall width={"hug"} fontWeight={"bold"}>
                <Translatable
                    resourceKey={i18nKey(
                        `We are just downloading a quick update and then we will have you on your way ...`,
                    )} />
            </BodySmall>

            <Progress
                colour={ColourVars.primary}
                size={"1rem"}
                percent={checker.versionState.downloadProgress} />

            <Button
                disabled={checker.versionState.downloadProgress < 100}
                onClick={() => checker.reload()}
                secondary>
                <Translatable resourceKey={i18nKey("Reload and continue")} />
            </Button>
        </Column>
    </Sheet>
{/if}

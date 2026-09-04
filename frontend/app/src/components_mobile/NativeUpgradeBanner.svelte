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

    onDestroy(() => checker.stop());

    // A store build can only be updated through the store it came from; a
    // sideloaded build has to fetch a new APK itself.
    let upgradeUrl = $derived(appStoreBuild ? PLAY_STORE_URL : DIRECT_DOWNLOAD_URL);
</script>

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
                <Translatable
                    resourceKey={i18nKey(
                        appStoreBuild ? "Update from the Play Store" : "Download the latest version",
                    )} />
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

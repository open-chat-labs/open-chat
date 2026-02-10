<script lang="ts">
    import { VersionChecker } from "@src/utils/version.svelte";
    import { Body, BodySmall, ColourVars, Column, Row } from "component-lib";
    import { i18nKey } from "../i18n/i18n";
    import Progress from "./Progress.svelte";
    import Translatable from "./Translatable.svelte";

    let checker = new VersionChecker();
</script>

<pre>{checker.versionState}</pre>

{#if checker.versionState.kind !== "up_to_date"}
    <Column
        mainAxisAlignment={"center"}
        crossAxisAlignment={"center"}
        backgroundColor={ColourVars.warning}
        padding={"lg"}
        gap={"lg"}
        supplementalClass={"upgrade_banner"}>
        <Row>
            <Body width={"hug"} fontWeight={"bold"}>
                {#if checker.versionState.kind === "unknown"}
                    <Translatable resourceKey={i18nKey(`Checking for updates ...`)} />
                {:else if checker.versionState.kind === "failed_update"}
                    <Translatable
                        resourceKey={i18nKey(
                            `An update is available but we were unable to load it ...`,
                        )} />
                {:else if checker.versionState.kind === "out_of_date"}
                    <Translatable
                        resourceKey={i18nKey(
                            `The app is currently updating to version ${checker.versionState.available.toText()} ...`,
                        )} />
                {/if}
            </Body>
        </Row>
        {#if checker.versionState.kind === "out_of_date"}
            <Row crossAxisAlignment="center" gap={"md"}>
                <Progress
                    colour={ColourVars.textPrimary}
                    size={"1rem"}
                    percent={checker.versionState.downloadProgress} />

                <BodySmall width={"hug"} fontWeight={"light"}>
                    <a href="/" onclick={() => checker.reload()}
                        ><Translatable resourceKey={i18nKey("updateNow")} /></a>
                </BodySmall>
            </Row>
        {/if}
    </Column>
{/if}

<style lang="scss">
    :global(.container.upgrade_banner) {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        @include z-index("upgrade-banner");
    }

    a {
        text-decoration: underline;
        text-underline-offset: $sp1;
        cursor: pointer;
        color: inherit;
    }
</style>

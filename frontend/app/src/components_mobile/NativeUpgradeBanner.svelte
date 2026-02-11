<script lang="ts">
    import { VersionChecker } from "@src/utils/version.svelte";
    import { BodySmall, Button, ColourVars, Column, Overview, Sheet } from "component-lib";
    import { onDestroy } from "svelte";
    import { i18nKey } from "../i18n/i18n";
    import Progress from "./Progress.svelte";
    import Translatable from "./Translatable.svelte";

    let checker = new VersionChecker();

    onDestroy(() => checker.stop());
</script>

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

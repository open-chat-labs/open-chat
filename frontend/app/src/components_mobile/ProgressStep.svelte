<script lang="ts">
    import { Body, BodySmall, ColourVars, Container, Row } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import { _ } from "svelte-i18n";
    import DoneIcon from "svelte-material-icons/CheckCircle.svelte";
    import FailedIcon from "svelte-material-icons/CloseCircle.svelte";
    import { interpolate } from "../i18n/i18n";
    import { currentTheme } from "../theme/themes";
    import Markdown from "./home/Markdown.svelte";
    import Spinner from "./icons/Spinner.svelte";

    interface Props {
        label: ResourceKey;
        status: string;
        step?: number;
    }

    let { label, status, step = 0 }: Props = $props();

    const colours: Record<string, string> = {
        todo: ColourVars.textPrimary,
        done: ColourVars.success,
        failed: ColourVars.error,
    };
</script>

<Row padding={["sm", "zero"]} gap={"md"} crossAxisAlignment={"center"}>
    {#if status === "doing"}
        <div class="spinner">
            <Spinner
                size="1.6rem"
                strokeWidth={"2px"}
                foregroundColour={$currentTheme.toast.success.bg}
                backgroundColour={"rgba(255,255,255,0.5)"}></Spinner>
            <div class="number">
                <BodySmall align={"center"} width={"hug"}>
                    {step + 1}
                </BodySmall>
            </div>
        </div>
    {:else if status === "overall-done"}
        <DoneIcon size="1.6rem" color={ColourVars.success} />
    {:else if status === "overall-failed"}
        <FailedIcon size="1.6rem" color={ColourVars.error} />
    {:else}
        <Container
            borderColour={colours[status] ?? ColourVars.textPrimary}
            borderWidth={"thick"}
            borderRadius={"circle"}
            mainAxisAlignment={"center"}
            crossAxisAlignment={"center"}
            width={{ size: "1.5rem" }}
            height={{ size: "1.5rem" }}>
            <BodySmall width={"hug"}>
                {step + 1}
            </BodySmall>
        </Container>
    {/if}
    <Body>
        <Markdown text={interpolate($_, label)} />
    </Body>
</Row>

<style lang="scss">
    .spinner {
        position: relative;
        height: 24px;
        width: 24px;
        .number {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }
    }
</style>

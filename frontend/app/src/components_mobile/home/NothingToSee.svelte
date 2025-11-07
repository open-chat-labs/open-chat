<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Body,
        BodySmall,
        ColourVars,
        CommonButton,
        Container,
        type Padding,
        type SizeMode,
    } from "component-lib";
    import Chat from "svelte-material-icons/ChatOutline.svelte";
    import Robot from "svelte-material-icons/RobotExcitedOutline.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        onReset?: () => void;
        title: string;
        subtitle: string;
        reset?: string;
        height?: SizeMode;
        padding?: Padding;
    }

    let {
        onReset,
        title,
        subtitle,
        reset,
        height = { kind: "fill" },
        padding = ["huge", "zero", "zero", "zero"],
    }: Props = $props();
</script>

<Container
    {height}
    {padding}
    gap={"xl"}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"start"}
    direction={"vertical"}>
    <Robot color={ColourVars.primary} size={"6rem"} />

    <Container
        gap={"xs"}
        crossAxisAlignment={"center"}
        width={{ kind: "hug" }}
        direction={"vertical"}>
        <Body colour={"primary"} width={{ kind: "hug" }} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey(title)}></Translatable>
        </Body>
        <BodySmall width={{ kind: "hug" }} colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey(subtitle)}></Translatable>
        </BodySmall>
    </Container>

    {#if onReset && reset}
        <CommonButton onClick={onReset}>
            {#snippet icon(color, size)}
                <Chat {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey(reset)}></Translatable>
        </CommonButton>
    {/if}
</Container>

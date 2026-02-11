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
    import type { Snippet } from "svelte";
    import Robot from "svelte-material-icons/RobotExcitedOutline.svelte";
    import Translatable from "../Translatable.svelte";

    interface ButtonProps {
        onClick: () => void;
        text: string;
        icon?: Snippet<[string, string]>;
    }

    interface Props {
        title: string;
        subtitle: string;
        height?: SizeMode;
        padding?: Padding;
        icon?: Snippet<[string, string]>;
        reset?: ButtonProps;
    }

    let {
        title,
        subtitle,
        reset,
        height = "fill",
        padding = ["huge", "zero", "zero", "zero"],
        icon,
    }: Props = $props();
</script>

<Container
    {height}
    {padding}
    gap={"xl"}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"start"}
    direction={"vertical"}>
    {#if icon}
        {@render icon(ColourVars.primary, "6rem")}
    {:else}
        <Robot color={ColourVars.primary} size={"6rem"} />
    {/if}

    <Container gap={"xs"} crossAxisAlignment={"center"} width={"hug"} direction={"vertical"}>
        <Body align={"center"} colour={"primary"} width={"hug"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey(title)}></Translatable>
        </Body>
        <BodySmall align={"center"} width={"hug"} colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey(subtitle)}></Translatable>
        </BodySmall>
    </Container>

    {#if reset}
        <CommonButton icon={reset.icon} onClick={reset.onClick}>
            <Translatable resourceKey={i18nKey(reset.text)}></Translatable>
        </CommonButton>
    {/if}
</Container>

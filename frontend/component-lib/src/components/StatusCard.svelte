<script lang="ts">
    import { Body, ColourVars, Container } from "component-lib";
    import type { Snippet } from "svelte";
    import Info from "svelte-material-icons/AlertCircleOutline.svelte";
    import Warning from "svelte-material-icons/AlertRhombusOutline.svelte";

    type Mode = "warning" | "information";

    interface Props {
        mode: Mode;
        title: string;
        body: string | Snippet;
        confirmed?: boolean;
        confirmation?: string;
        icon?: Snippet<[string, string]>;
        background?: string;
        borderColour?: string;
    }

    let {
        mode,
        title,
        body,
        confirmed = $bindable(false),
        icon,
        borderColour,
        background = ColourVars.background1,
    }: Props = $props();

    let iconColour = $derived(mode === "information" ? ColourVars.secondary : ColourVars.warning);
</script>

<Container
    {borderColour}
    borderRadius={"lg"}
    borderWidth={borderColour ? "thick" : "zero"}
    gap={"md"}
    direction={"vertical"}
    padding={"lg"}
    {background}>
    <Container crossAxisAlignment={"center"} gap={"sm"}>
        {#if icon}
            {@render icon(iconColour, "1.5rem")}
        {:else if mode === "information"}
            <Info size={"1.5rem"} color={iconColour} />
        {:else}
            <Warning size={"1.5rem"} color={iconColour} />
        {/if}
        <Body colour={mode === "information" ? "secondary" : "warning"} fontWeight={"bold"}>
            {title}
        </Body>
    </Container>
    <Body colour={"textSecondary"}>
        {#if typeof body === "string"}
            {body}
        {:else}
            {@render body()}
        {/if}
    </Body>
</Container>

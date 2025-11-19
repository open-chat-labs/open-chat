<script lang="ts">
    import { Body, ColourVars, Container } from "component-lib";
    import type { Snippet } from "svelte";
    import Info from "svelte-material-icons/AlertCircleOutline.svelte";
    import Warning from "svelte-material-icons/AlertRhombusOutline.svelte";

    type Mode = "warning" | "information";

    interface Props {
        mode: Mode;
        title: string;
        body: string;
        confirmed?: boolean;
        confirmation?: string;
        icon?: Snippet<[string, string]>;
    }

    let { mode, title, body, confirmed = $bindable(false), confirmation, icon }: Props = $props();

    let iconColour = $derived(mode === "information" ? ColourVars.secondary : ColourVars.warning);
</script>

<Container
    borderRadius={"lg"}
    gap={"md"}
    direction={"vertical"}
    padding={"lg"}
    background={ColourVars.background1}>
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
        {body}
    </Body>
</Container>
